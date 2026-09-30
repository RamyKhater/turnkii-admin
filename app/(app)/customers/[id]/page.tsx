import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guard";
import { canAccessSection } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { owners, requests, projects, payments } from "@/lib/db/schema";
import { PageHeader, Card, StatTile, StatusBadge } from "@/components/ui";
import { fmtEGP, summarize, paymentState, PAYMENT_STATE_META, KIND_LABEL } from "@/lib/payments";
import { updateOwner } from "@/lib/customers/actions";

const field = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink";
const lbl = "block text-xs font-bold uppercase tracking-wider text-muted";
const PROJECT_STATUS: Record<string, string> = {
  active: "bg-info/10 text-info", on_hold: "bg-warn/10 text-warn", complete: "bg-lime/20 text-olive",
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canAccessSection(user.role, "customers")) redirect("/denied");
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) notFound();

  const db = await getDb();
  const [owner] = await db.select().from(owners).where(eq(owners.id, id)).limit(1);
  if (!owner) notFound();
  const email = owner.email.toLowerCase();

  const custRequests = await db
    .select()
    .from(requests)
    .where(sql`lower(${requests.email}) = ${email} or (${owner.phone} is not null and ${requests.phone} = ${owner.phone})`)
    .orderBy(desc(requests.createdAt));

  const custProjects = await db
    .select()
    .from(projects)
    .where(sql`${projects.ownerId} = ${id} or lower(${projects.ownerEmail}) = ${email}`)
    .orderBy(desc(projects.createdAt));

  const projIds = custProjects.map((p) => p.id);
  const custPayments = projIds.length
    ? await db.select().from(payments).where(inArray(payments.projectId, projIds)).orderBy(desc(payments.createdAt))
    : [];

  const contractTotal = custProjects.reduce((a, p) => a + p.contractValue, 0);
  const money = summarize(custPayments, contractTotal);
  const projName = new Map(custProjects.map((p) => [p.id, p.name]));

  const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

  return (
    <>
      <PageHeader
        eyebrow="Customer"
        title={owner.name}
        sub={`${owner.email}${owner.phone ? " · " + owner.phone : ""}`}
        actions={
          <div className="flex items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${owner.active ? "bg-lime/20 text-olive" : "bg-sand text-muted"}`}>{owner.active ? "Active" : "Disabled"}</span>
            <Link href="/customers" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Customers</Link>
          </div>
        }
      />

      <div className="space-y-5 p-6 lg:p-8">
        {/* Insight KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="Requests" value={custRequests.length} />
          <StatTile label="Projects" value={custProjects.length} hint={contractTotal ? fmtEGP(contractTotal) + " contracted" : undefined} />
          <StatTile label="Collected" value={fmtEGP(money.collected)} hint={contractTotal ? `${money.progress}% of contract` : undefined} />
          <StatTile label="Outstanding" value={fmtEGP(money.outstanding)} />
          <StatTile label="Overdue" value={fmtEGP(money.overdue)} hint="past due, unpaid" />
        </div>

        {/* Edit account */}
        <Card className="p-0">
          <details>
            <summary className="cursor-pointer list-none px-6 py-4 text-sm font-bold">Edit account details</summary>
            <form action={updateOwner} className="space-y-4 border-t border-line p-6">
              <input type="hidden" name="id" value={owner.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className={lbl}>Name</span><input name="name" required defaultValue={owner.name} className={field} /></label>
                <label className="block"><span className={lbl}>Email</span><input name="email" type="email" required defaultValue={owner.email} className={field} /></label>
                <label className="block"><span className={lbl}>Phone</span><input name="phone" defaultValue={owner.phone ?? ""} className={field} /></label>
                <label className="flex items-center gap-2 self-end pb-2">
                  <input type="checkbox" name="active" defaultChecked={owner.active} className="h-4 w-4 accent-olive" />
                  <span className="text-sm font-semibold">Account active (can sign in)</span>
                </label>
              </div>
              <button className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90">Save changes</button>
            </form>
          </details>
        </Card>

        {/* Requests */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4"><h2 className="text-sm font-bold">Requests <span className="text-muted">· {custRequests.length}</span></h2></div>
          {custRequests.length === 0 ? (
            <div className="px-5 pb-6 text-sm text-muted">No requests matched to this customer (by email or phone).</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <tbody>
                  {custRequests.map((r) => (
                    <tr key={r.id} className="border-t border-line hover:bg-sand/30">
                      <td className="px-5 py-2.5"><Link href={`/requests/${r.id}`} className="font-bold text-ink hover:text-olive">{r.ref}</Link></td>
                      <td className="px-3 py-2.5 text-sub capitalize">{r.kind}</td>
                      <td className="px-3 py-2.5 text-sub">{(r.services ?? []).join(", ") || "—"}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-5 py-2.5 text-right text-sub">{fmtDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Projects */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4"><h2 className="text-sm font-bold">Projects <span className="text-muted">· {custProjects.length}</span></h2></div>
          {custProjects.length === 0 ? (
            <div className="px-5 pb-6 text-sm text-muted">No projects yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <tbody>
                  {custProjects.map((p) => (
                    <tr key={p.id} className="border-t border-line hover:bg-sand/30">
                      <td className="px-5 py-2.5"><Link href={`/projects/${p.id}`} className="font-semibold text-ink hover:text-olive">{p.name}</Link></td>
                      <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${PROJECT_STATUS[p.status] ?? PROJECT_STATUS.active}`}>{p.status.replace("_", " ")}</span></td>
                      <td className="px-3 py-2.5 font-bold tabular">{fmtEGP(p.contractValue)}</td>
                      <td className="px-5 py-2.5 text-right text-sub">{fmtDate(p.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Payments */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4"><h2 className="text-sm font-bold">Payments <span className="text-muted">· {custPayments.length}</span></h2></div>
          {custPayments.length === 0 ? (
            <div className="px-5 pb-6 text-sm text-muted">No payments recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <tbody>
                  {custPayments.map((pm) => {
                    const st = paymentState(pm);
                    const meta = PAYMENT_STATE_META[st.state];
                    return (
                      <tr key={pm.id} className="border-t border-line hover:bg-sand/30">
                        <td className="px-5 py-2.5 font-semibold">{pm.label}<div className="text-xs text-muted">{KIND_LABEL[pm.kind] ?? pm.kind} · {projName.get(pm.projectId ?? -1) ?? ""}</div></td>
                        <td className="px-3 py-2.5 font-bold tabular">{fmtEGP(pm.amount)}</td>
                        <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.chip}`}>{meta.label}</span></td>
                        <td className="px-5 py-2.5 text-right text-sub">{fmtDate(pm.dueDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
