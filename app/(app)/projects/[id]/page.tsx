import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, asc, desc } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { projects, payments, properties, projectUpdates, users, styles } from "@/lib/db/schema";
import { PageHeader, Card, StatTile } from "@/components/ui";
import { fmtEGP, summarize, KIND_LABEL } from "@/lib/payments";
import { PaymentActions, PaymentStateBadge, AddPaymentForm } from "@/components/payments/controls";
import { ProjectForm } from "@/components/projects/project-form";
import { PostUpdateForm, UpdateRow } from "@/components/projects/updates";
import { updateProject } from "@/lib/projects/actions";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCap("payments:view");
  const manage = can(user.role, "payments:manage");
  const { id } = await params;
  const db = await getDb();
  const [pr] = await db.select().from(projects).where(eq(projects.id, Number(id))).limit(1);
  if (!pr) notFound();
  const [prop] = pr.propertyId ? await db.select().from(properties).where(eq(properties.id, pr.propertyId)).limit(1) : [null];
  const schedule = await db.select().from(payments).where(eq(payments.projectId, pr.id)).orderBy(asc(payments.dueDate));
  const sum = summarize(schedule, pr.contractValue);
  const updates = await db.select().from(projectUpdates).where(eq(projectUpdates.projectId, pr.id)).orderBy(desc(projectUpdates.createdAt));
  const us = await db.select({ id: users.id, name: users.name }).from(users);
  const nameOf = new Map(us.map((u) => [u.id, u.name]));
  const propRows = manage ? await db.select({ id: properties.id, name: properties.name }).from(properties).orderBy(asc(properties.name)) : [];
  const styleRows = manage ? await db.select({ key: styles.key, name: styles.name }).from(styles).orderBy(asc(styles.sortOrder)) : [];

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title={pr.name}
        sub={`${pr.status.replace("_", " ")}${prop ? ` · ${prop.name}` : ""}`}
        actions={<Link href="/projects" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Projects</Link>}
      />
      <div className="space-y-5 p-6 lg:p-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Contract value" value={fmtEGP(sum.contractValue)} />
          <StatTile label="Collected" value={fmtEGP(sum.collected)} hint={`${sum.progress}%`} />
          <StatTile label="Outstanding" value={fmtEGP(sum.outstanding)} hint={sum.pending ? `${fmtEGP(sum.pending)} pending` : undefined} />
          <StatTile label="Overdue" value={fmtEGP(sum.overdue)}
            hint={sum.nextDue?.dueDate ? `next due ${new Date(sum.nextDue.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}` : undefined} />
        </div>

        {prop && (
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold">Owner</h2>
                <p className="mt-1 text-sm">{prop.ownerName} · <a href={`tel:${prop.ownerPhone}`} className="hover:text-ink">{prop.ownerPhone}</a>{prop.ownerEmail ? <> · <a href={`mailto:${prop.ownerEmail}`} className="hover:text-ink">{prop.ownerEmail}</a></> : null}</p>
              </div>
              <Link href="/properties" className="text-sm font-bold text-olive hover:text-ink">{prop.name} →</Link>
            </div>
          </Card>
        )}

        {manage && (
          <Card className="p-0">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-bold">
                Edit project details
                <span className="text-xs font-semibold text-olive group-open:hidden">Edit →</span>
                <span className="hidden text-xs font-semibold text-muted group-open:inline">Close</span>
              </summary>
              <div className="border-t border-line p-5">
                <ProjectForm action={updateProject} project={pr} properties={propRows} styles={styleRows} />
              </div>
            </details>
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="px-5 py-4"><h2 className="text-sm font-bold">Payment schedule</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-y border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-bold">Payment</th>
                  <th className="px-3 py-3 font-bold">Amount</th>
                  <th className="px-3 py-3 font-bold">Due</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold text-right">{manage ? "Actions" : ""}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <div className="font-semibold">{p.label}</div>
                      <div className="text-xs text-muted">{KIND_LABEL[p.kind] ?? p.kind}{p.reference ? ` · ${p.reference}` : ""}{p.paidAt ? ` · paid ${new Date(p.paidAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}` : ""}</div>
                    </td>
                    <td className="px-3 py-3 font-bold tabular">{fmtEGP(p.amount)}</td>
                    <td className="px-3 py-3 text-sub tabular">{p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}</td>
                    <td className="px-3 py-3"><PaymentStateBadge payment={p} /></td>
                    <td className="px-5 py-3 text-right">{manage ? <PaymentActions payment={p} /> : (p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-olive">Receipt</a>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {manage && (
            <div className="border-t border-line p-5">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Add a scheduled payment</h3>
              <AddPaymentForm projectId={pr.id} />
            </div>
          )}
        </Card>

        <Card className="p-5 lg:p-6">
          <h2 className="text-sm font-bold">Project updates</h2>
          <p className="text-xs text-sub">Progress the owner sees in their portal.</p>
          {manage && <div className="mt-4 rounded-2xl border border-line p-4"><PostUpdateForm projectId={pr.id} /></div>}
          <ol className="mt-6 space-y-4">
            {updates.map((u) => (
              <UpdateRow key={u.id} update={u} authorName={u.authorId ? nameOf.get(u.authorId) : undefined} canManage={manage} />
            ))}
            {updates.length === 0 && <li className="text-sm text-muted">No updates posted yet.</li>}
          </ol>
        </Card>
      </div>
    </>
  );
}
