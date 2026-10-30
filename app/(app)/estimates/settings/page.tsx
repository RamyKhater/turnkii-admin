import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { getEstimateConfig } from "@/lib/estimate/store";
import { assembleEstimate } from "@/lib/estimate/engine";
import { PageHeader, Card } from "@/components/ui";
import { FinanceEditor, ScopeEditor, RatesEditor } from "@/components/estimates/config-editor";

export const dynamic = "force-dynamic";
const egp = (n: number) => "EGP " + Math.round(n).toLocaleString("en-US");

export default async function EstimateSettings({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "settings:manage")) redirect("/denied");
  const { q } = await searchParams;
  const quotation = Math.max(0, Number(q) || 7_000_000);
  const { rates, finance, scope } = await getEstimateConfig();
  const out = assembleEstimate(quotation, finance, scope);

  return (
    <>
      <PageHeader eyebrow="Estimates" title="Estimate engine settings"
        sub="The admin-managed inputs behind every estimate and payment plan. Changes apply to new estimates immediately."
        actions={<Link href="/estimates" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Estimates</Link>} />
      <div className="space-y-5 p-6 lg:p-8">
        {/* Live worked example */}
        <Card className="p-5">
          <form className="flex flex-wrap items-end gap-3">
            <div><label className="block text-xs font-bold uppercase tracking-wide text-muted">Preview quotation (EGP)</label>
              <input name="q" defaultValue={quotation} className="mt-1 w-48 rounded-lg border border-line bg-white px-3 py-2 text-sm" /></div>
            <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">Preview</button>
            <span className="text-xs text-sub">Selected {Math.round(out.selected.downPct * 100)}% down / {out.selected.tenor} mo · {finance.method === "reducing" ? "reducing balance" : "flat"}</span>
          </form>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile k="Monthly installment" v={egp(out.selected.monthly)} n={`${out.selected.tenor} payments`} />
            <Tile k="Down payment" v={egp(out.selected.downPayment)} n={out.fundingByDown.find((f) => f.downPct === out.selected.downPct)?.fundsLabel} />
            <Tile k="Total over plan" v={egp(out.selected.totalCost)} n={`+${Math.round(out.selected.costAboveCash * 100)}% vs cash`} />
            <Tile k="Min income / mo" v={egp(out.selected.minIncome)} n={`works ${out.worksDurationMonths} mo · ${out.totalWeeks} wks`} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm tabular-nums">
              <thead><tr className="bg-sand/40 text-left text-xs uppercase tracking-wide text-muted"><th className="px-3 py-2">Monthly</th><th className="px-3 py-2">Down</th>{finance.tenorOptions.map((t) => <th key={t} className="px-3 py-2 text-right">{t} mo</th>)}</tr></thead>
              <tbody>
                {finance.downOptions.map((d) => (
                  <tr key={d} className="border-t border-line"><td className="px-3 py-2">{Math.round(d * 100)}%</td><td className="px-3 py-2">{egp(quotation * d)}</td>
                    {finance.tenorOptions.map((t) => <td key={t} className="px-3 py-2 text-right">{egp(out.scenarios.find((s) => s.downPct === d && s.tenor === t)!.monthly)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <FinanceEditor cfg={finance} />
        <ScopeEditor rows={scope} />
        <RatesEditor card={rates} />
      </div>
    </>
  );
}

function Tile({ k, v, n }: { k: string; v: string; n?: string }) {
  return <div className="rounded-xl border border-line bg-white p-4"><div className="text-xs font-bold uppercase tracking-wide text-muted">{k}</div><div className="mt-1 text-xl font-bold tabular">{v}</div>{n && <div className="mt-1 text-xs text-sub">{n}</div>}</div>;
}
