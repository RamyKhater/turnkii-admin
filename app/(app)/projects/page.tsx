import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { projects, payments, properties } from "@/lib/db/schema";
import { PageHeader, Card, StatTile } from "@/components/ui";
import { fmtEGP, summarize } from "@/lib/payments";
import { DeliveryDigest } from "@/components/projects/delivery-digest";
import { ClickableRow } from "@/components/requests/clickable-row";

const STATUS_CHIP: Record<string, string> = {
  active: "bg-info/10 text-info", on_hold: "bg-warn/15 text-warn", complete: "bg-ok/12 text-ok",
};

export default async function ProjectsPage() {
  const user = await requireCap("payments:view");
  const manage = can(user.role, "payments:manage");
  const db = await getDb();
  const projRows = await db.select().from(projects).orderBy(asc(projects.name));
  const payRows = await db.select().from(payments);
  const propRows = await db.select({ id: properties.id, name: properties.name }).from(properties);
  const propName = new Map(propRows.map((p) => [p.id, p.name]));

  const summaries = projRows.map((pr) => ({
    project: pr,
    sum: summarize(payRows.filter((p) => p.projectId === pr.id), pr.contractValue),
  }));

  const totalContract = projRows.reduce((a, p) => a + p.contractValue, 0);
  const totalCollected = summaries.reduce((a, s) => a + s.sum.collected, 0);
  const totalOverdue = summaries.reduce((a, s) => a + s.sum.overdue, 0);

  return (
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Projects"
        sub="Engagements under contract, with payment progress."
        actions={manage ? <Link href="/projects/new" className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-cream hover:bg-lime hover:text-ink">+ New project</Link> : undefined}
      />
      <div className="space-y-5 p-6 lg:p-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Projects" value={projRows.length} />
          <StatTile label="Contracted" value={fmtEGP(totalContract)} />
          <StatTile label="Collected" value={fmtEGP(totalCollected)} hint={`${totalContract ? Math.round((totalCollected / totalContract) * 100) : 0}%`} />
          <StatTile label="Overdue" value={fmtEGP(totalOverdue)} />
        </div>

        {can(user.role, "projects:manage") && <DeliveryDigest />}

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-bold">Project</th>
                  <th className="px-3 py-3 font-bold">Contract</th>
                  <th className="px-3 py-3 font-bold">Collected</th>
                  <th className="px-3 py-3 font-bold">Outstanding</th>
                  <th className="px-3 py-3 font-bold">Overdue</th>
                  <th className="px-3 py-3 font-bold">Next due</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map(({ project: pr, sum }) => (
                  <ClickableRow key={pr.id} href={`/projects/${pr.id}`} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <Link href={`/projects/${pr.id}`} className="font-bold hover:text-olive">{pr.name}</Link>
                      <div className="text-xs text-muted">{pr.propertyId ? propName.get(pr.propertyId) : ""}</div>
                    </td>
                    <td className="px-3 py-3 tabular">{fmtEGP(sum.contractValue)}</td>
                    <td className="px-3 py-3 tabular">
                      {fmtEGP(sum.collected)}
                      <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-sand">
                        <div className="h-full rounded-full bg-ok" style={{ width: `${sum.progress}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold tabular">{fmtEGP(sum.outstanding)}</td>
                    <td className={`px-3 py-3 tabular ${sum.overdue ? "font-bold text-crit" : "text-muted"}`}>{sum.overdue ? fmtEGP(sum.overdue) : "—"}</td>
                    <td className="px-3 py-3 text-sub tabular">
                      {sum.nextDue?.dueDate
                        ? <>{new Date(sum.nextDue.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}<div className={`text-xs ${(sum.nextDue.daysTillDue ?? 0) < 0 ? "text-crit" : "text-muted"}`}>{sum.nextDue.daysTillDue != null ? (sum.nextDue.daysTillDue < 0 ? `${Math.abs(sum.nextDue.daysTillDue)}d overdue` : `in ${sum.nextDue.daysTillDue}d`) : ""}</div></>
                        : "—"}
                    </td>
                    <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CHIP[pr.status] ?? "bg-sand text-muted"}`}>{pr.status.replace("_", " ")}</span></td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
