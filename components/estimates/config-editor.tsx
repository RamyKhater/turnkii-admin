"use client";
import { useActionState, useState } from "react";
import { saveEstimateFinance, saveEstimateScope, saveEstimateRates, type CfgState } from "@/lib/estimate/config-actions";
import type { FinanceInputs } from "@/lib/estimate/finance";
import type { ScopePackage } from "@/lib/estimate/scope";
import type { EstimateRateCard } from "@/lib/estimate/rates";

const card = "rounded-2xl border border-line bg-paper p-5";
const label = "block text-xs font-bold uppercase tracking-wide text-muted";
const input = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm";
const btn = "rounded-full bg-ink px-4 py-2 text-sm font-bold text-cream hover:bg-lime hover:text-ink disabled:opacity-60";
const pct = (n: number) => +(n * 100).toFixed(4);

function Msg({ s }: { s: CfgState }) {
  if (s.ok) return <span className="text-xs font-bold text-ok">Saved ✓</span>;
  if (s.error) return <span className="text-xs font-bold text-crit">{s.error}</span>;
  return null;
}

export function FinanceEditor({ cfg }: { cfg: FinanceInputs }) {
  const [state, action, pending] = useActionState(saveEstimateFinance, {} as CfgState);
  return (
    <form action={action} className={card}>
      <h3 className="text-sm font-bold">Finance inputs</h3>
      <p className="text-xs text-sub">Confirmed with the finance partner before any client sees a number.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className={label}>Annual interest rate %</label><input className={input} name="annualRate" type="number" step="0.01" defaultValue={pct(cfg.annualRate)} /></div>
        <div><label className={label}>Interest method</label>
          <select className={input} name="method" defaultValue={cfg.method}><option value="reducing">Reducing balance</option><option value="flat">Flat</option></select></div>
        <div><label className={label}>Admin fee % (of financed)</label><input className={input} name="adminFeePct" type="number" step="0.01" defaultValue={pct(cfg.adminFeePct)} /></div>
        <div><label className={label}>Max debt-burden ratio %</label><input className={input} name="debtBurdenRatio" type="number" step="0.1" defaultValue={pct(cfg.debtBurdenRatio)} /></div>
        <div><label className={label}>Down-payment options % (comma)</label><input className={input} name="downOptions" defaultValue={cfg.downOptions.map(pct).join(", ")} /></div>
        <div><label className={label}>Tenor options, months (comma)</label><input className={input} name="tenorOptions" defaultValue={cfg.tenorOptions.join(", ")} /></div>
        <div><label className={label}>Default down payment %</label><input className={input} name="selectedDownPct" type="number" step="1" defaultValue={pct(cfg.selectedDownPct)} /></div>
        <div><label className={label}>Default tenor, months</label><input className={input} name="selectedTenor" type="number" step="1" defaultValue={cfg.selectedTenor} /></div>
      </div>
      <div className="mt-4 flex items-center gap-3"><button className={btn} disabled={pending}>Save finance inputs</button><Msg s={state} /></div>
    </form>
  );
}

export function ScopeEditor({ rows: initial }: { rows: ScopePackage[] }) {
  const [state, action, pending] = useActionState(saveEstimateScope, {} as CfgState);
  const [rows, setRows] = useState(initial);
  const total = rows.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const set = (i: number, k: keyof ScopePackage, v: string) =>
    setRows((rs) => rs.map((r, j) => j === i ? { ...r, [k]: k === "pct" ? Number(v) / 100 : k === "name" || k === "scope" ? v : Number(v) } : r));
  return (
    <form action={action} className={card}>
      <h3 className="text-sm font-bold">Scope &amp; timeline template</h3>
      <p className="text-xs text-sub">Shares must total 100% — currently <span className={Math.abs(total - 1) < 0.005 ? "text-ok" : "text-crit"}>{(total * 100).toFixed(1)}%</span>.</p>
      <input type="hidden" name="rows" value={JSON.stringify(rows)} />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="text-left text-xs uppercase tracking-wide text-muted"><th className="py-2 pr-2">Package</th><th className="px-2">%</th><th className="px-2">Start wk</th><th className="px-2">Weeks</th><th></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1.5 pr-2"><input className={input + " mt-0"} value={r.name} onChange={(e) => set(i, "name", e.target.value)} />
                  <input className={input + " mt-1 text-xs"} value={r.scope} onChange={(e) => set(i, "scope", e.target.value)} /></td>
                <td className="px-2"><input className={input + " mt-0 w-16"} type="number" step="0.1" value={+(r.pct * 100).toFixed(2)} onChange={(e) => set(i, "pct", e.target.value)} /></td>
                <td className="px-2"><input className={input + " mt-0 w-16"} type="number" value={r.startWeek} onChange={(e) => set(i, "startWeek", e.target.value)} /></td>
                <td className="px-2"><input className={input + " mt-0 w-16"} type="number" value={r.durationWeeks} onChange={(e) => set(i, "durationWeeks", e.target.value)} /></td>
                <td><button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="text-xs font-bold text-crit">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setRows((rs) => [...rs, { name: "New package", scope: "", pct: 0, startWeek: 0, durationWeeks: 4 }])} className="rounded-full border border-line px-3 py-1.5 text-xs font-bold hover:border-ink">+ Add package</button>
        <button className={btn} disabled={pending}>Save scope</button><Msg s={state} />
      </div>
    </form>
  );
}

export function RatesEditor({ card: rc }: { card: EstimateRateCard }) {
  const [state, action, pending] = useActionState(saveEstimateRates, {} as CfgState);
  return (
    <form action={action} className={card}>
      <h3 className="text-sm font-bold">Cost rate card</h3>
      <p className="text-xs text-sub">EGP rates by package × tier used to auto-cost a brief. Edit as JSON; seeded from the FLPP catalog assumptions.</p>
      <textarea name="json" className={input + " mt-3 font-mono text-xs"} rows={16} defaultValue={JSON.stringify(rc, null, 2)} />
      <div className="mt-3 flex items-center gap-3"><button className={btn} disabled={pending}>Save rate card</button><Msg s={state} /></div>
    </form>
  );
}
