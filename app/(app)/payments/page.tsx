import Link from "next/link";
import { requireCap } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { payments, projects, properties } from "@/lib/db/schema";
import { PageHeader, Card, StatTile } from "@/components/ui";
import { fmtEGP, paymentState, summarize, KIND_LABEL } from "@/lib/payments";
import { PaymentActions, PaymentStateBadge } from "@/components/payments/controls";
import { ExportMenu } from "@/components/insights/export-menu";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const user = await requireCap("payments:view");
  const manage = can(user.role, "payments:manage");
  const sp = await searchParams;
  const db = await getDb();

  const all = await db.select().from(payments);
  const projRows = await db.select({ id: projects.id, name: projects.name, contractValue: projects.contractValue }).from(projects);
  const propRows = await db.select({ id: properties.id, name: properties.name }).from(properties);
  const projName = new Map(projRows.map((p) => [p.id, p.name]));
  const propName = new Map(propRows.map((p) => [p.id, p.name]));
  const totalContract = projRows.reduce((a, p) => a + p.contractValue, 0);
  const sum = summarize(all, totalContract);
  const pendingCount = all.filter((p) => p.status === "pending").length;

  const filtered = sp.state
    ? all.filter((p) => paymentState(p).state === sp.state)
    : all;
  const rows = filtered.sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const dbt = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return da - dbt;
  });

  const tabs = [
    { k: "", label: "All" },
    { k: "overdue", label: "Overdue" },
    { k: "pending", label: "Pending verification" },
    { k: "due", label: "Due" },
    { k: "paid", label: "Paid" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        sub="Down payments, milestones and receipts across all projects."
        actions={<ExportMenu />}
      />
      <div className="space-y-5 p-6 lg:p-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Collected" value={fmtEGP(sum.collected)} hint={`of ${fmtEGP(sum.contractValue)} contracted`} />
          <StatTile label="Outstanding" value={fmtEGP(sum.outstanding)} hint={`${sum.progress}% collected`} />
          <StatTile label="Overdue" value={fmtEGP(sum.overdue)} hint="past due, unpaid" />
          <StatTile label="Pending verification" value={fmtEGP(sum.pending)} hint={`${pendingCount} receipt${pendingCount === 1 ? "" : "s"}`} />
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = (sp.state ?? "") === t.k;
            return (
              <Link key={t.k} href={t.k ? `/payments?state=${t.k}` : "/payments"}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-ink text-cream" : "border border-line bg-paper hover:border-ink"}`}>
                {t.label}
              </Link>
            );
          })}
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-bold">Payment</th>
                  <th className="px-3 py-3 font-bold">Project · property</th>
                  <th className="px-3 py-3 font-bold">Amount</th>
                  <th className="px-3 py-3 font-bold">Due</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold text-right">{manage ? "Actions" : ""}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <div className="font-semibold">{p.label}</div>
                      <div className="text-xs text-muted">{KIND_LABEL[p.kind] ?? p.kind}{p.reference ? ` · ${p.reference}` : ""}</div>
                    </td>
                    <td className="px-3 py-3">
                      {p.projectId ? <Link href={`/projects/${p.projectId}`} className="font-semibold hover:text-olive">{projName.get(p.projectId)}</Link> : "—"}
                      <div className="text-xs text-muted">{p.propertyId ? propName.get(p.propertyId) : ""}</div>
                    </td>
                    <td className="px-3 py-3 font-bold tabular">{fmtEGP(p.amount)}</td>
                    <td className="px-3 py-3 text-sub tabular">{p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}</td>
                    <td className="px-3 py-3"><PaymentStateBadge payment={p} /></td>
                    <td className="px-5 py-3 text-right">{manage ? <PaymentActions payment={p} /> : (p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-olive">Receipt</a>)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-muted">No payments match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
