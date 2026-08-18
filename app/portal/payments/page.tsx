import { eq, asc } from "drizzle-orm";
import { requireOwner } from "@/lib/owner/session";
import { getDb } from "@/lib/db";
import { properties, projects, payments } from "@/lib/db/schema";
import { PortalShell } from "@/components/portal/shell";
import { PayButton } from "@/components/portal/pay-dialog";
import { fmtEGP, summarize, paymentState, PAYMENT_STATE_META, KIND_LABEL } from "@/lib/payments";

export default async function PortalPayments() {
  const owner = await requireOwner();
  const db = await getDb();
  const props = await db.select().from(properties).where(eq(properties.ownerId, owner.id));
  const projs = await db.select().from(projects).where(eq(projects.ownerId, owner.id)).orderBy(asc(projects.name));
  const projName = new Map(projs.map((p) => [p.id, p.name]));
  const projIds = new Set(projs.map((p) => p.id));
  const propIds = new Set(props.map((p) => p.id));
  const all = await db.select().from(payments).orderBy(asc(payments.dueDate));
  const mine = all.filter((p) => (p.projectId && projIds.has(p.projectId)) || (p.propertyId && propIds.has(p.propertyId)));
  const sum = summarize(mine, projs.reduce((a, p) => a + p.contractValue, 0));

  return (
    <PortalShell owner={owner} active="payments">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Payments</p>
        <h1 className="mt-1 font-serif text-4xl">Your payments</h1>
        <p className="mt-1 text-sm text-sub">
          {fmtEGP(sum.collected)} paid · <span className="font-semibold text-ink">{fmtEGP(sum.outstanding)} outstanding</span>
          {sum.pending ? <> · {fmtEGP(sum.pending)} awaiting verification</> : null}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-paper">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-bold">Payment</th>
                <th className="px-3 py-3 font-bold">Project</th>
                <th className="px-3 py-3 font-bold">Amount</th>
                <th className="px-3 py-3 font-bold">Due</th>
                <th className="px-3 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold text-right"></th>
              </tr>
            </thead>
            <tbody>
              {mine.map((p) => {
                const { state } = paymentState(p);
                const m = PAYMENT_STATE_META[state];
                return (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <div className="font-semibold">{p.label}</div>
                      <div className="text-xs text-muted">{KIND_LABEL[p.kind] ?? p.kind}</div>
                    </td>
                    <td className="px-3 py-3 text-sub">{p.projectId ? projName.get(p.projectId) : "—"}</td>
                    <td className="px-3 py-3 font-bold tabular">{fmtEGP(p.amount)}</td>
                    <td className="px-3 py-3 text-sub tabular">{p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}</td>
                    <td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${m.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{m.label}</span></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-olive hover:text-ink">Receipt</a>}
                        {(state === "due" || state === "overdue") && <PayButton payment={p} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {mine.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-muted">No payments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </PortalShell>
  );
}
