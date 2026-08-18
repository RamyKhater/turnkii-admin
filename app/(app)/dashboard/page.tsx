import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guard";
import { canAccessSection, homeSectionFor, can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { requests, users, styles, services, payments, projects, type Request } from "@/lib/db/schema";
import { PageHeader, Card, StatTile, StatusBadge, Avatar, PIPELINE, STATUS_META } from "@/components/ui";
import { firstResponseSla, resolutionSla } from "@/lib/sla";
import { getSiteConfig } from "@/lib/settings";
import { sourceInsights, serviceInsights, userInsights } from "@/lib/insights";
import { fmtEGP, summarize, paymentState } from "@/lib/payments";
import { ExportMenu } from "@/components/insights/export-menu";

export default async function DashboardPage() {
  const user = await requireUser();
  if (!canAccessSection(user.role, "dashboard")) redirect(homeSectionFor(user.role));
  const isAgent = user.role === "agent";

  const db = await getDb();
  const rows: Request[] = isAgent
    ? await db.select().from(requests).where(eq(requests.assignedTo, user.id))
    : await db.select().from(requests);
  const us = await db.select({ id: users.id, name: users.name, role: users.role, active: users.active }).from(users);
  const nameOf = new Map(us.map((u) => [u.id, u.name]));
  const styleRows = await db.select({ key: styles.key, name: styles.name }).from(styles);
  const styleName = new Map(styleRows.map((s) => [s.key, s.name]));

  const total = rows.length;
  const won = rows.filter((r) => r.status === "won").length;
  const lost = rows.filter((r) => r.status === "lost").length;
  const open = rows.filter((r) => r.status !== "won" && r.status !== "lost").length;
  const unassigned = rows.filter((r) => !r.assignedTo).length;
  const wonRate = won + lost ? Math.round((won / (won + lost)) * 100) : 0;
  const now = new Date();
  const monthCount = rows.filter(
    (r) => r.createdAt.getMonth() === now.getMonth() && r.createdAt.getFullYear() === now.getFullYear(),
  ).length;

  const byStatus = PIPELINE.map((s) => ({ status: s, count: rows.filter((r) => r.status === s).length }));
  const maxStatus = Math.max(1, ...byStatus.map((b) => b.count));

  // last 8 weeks intake
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = new Date(now.getTime() - i * 7 * 86400_000);
    const start = new Date(end.getTime() - 7 * 86400_000);
    const count = rows.filter((r) => r.createdAt > start && r.createdAt <= end).length;
    return { label: `${8 - i}`, count };
  }).reverse();
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));

  const byStyle = styleRows
    .map((s) => ({ name: s.name, count: rows.filter((r) => r.style === s.key).length }))
    .sort((a, b) => b.count - a.count);
  const maxStyle = Math.max(1, ...byStyle.map((s) => s.count));

  const agents = us.filter((u) => u.role === "agent" || u.role === "ops_manager");
  const load = agents
    .map((a) => ({
      name: a.name,
      count: rows.filter((r) => r.assignedTo === a.id && r.status !== "won" && r.status !== "lost").length,
    }))
    .sort((a, b) => b.count - a.count);
  const maxLoad = Math.max(1, ...load.map((l) => l.count));

  const recent = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 6);

  // SLA metrics
  const { sla } = await getSiteConfig();
  const responded = rows.filter((r) => r.firstResponseAt);
  const respondedOnTime = responded.filter((r) => firstResponseSla(r, sla.firstResponseHours).state === "met").length;
  const frCompliance = responded.length ? Math.round((respondedOnTime / responded.length) * 100) : 100;
  const resolvedRows = rows.filter((r) => r.resolvedAt);
  const avgResolveDays = resolvedRows.length
    ? (resolvedRows.reduce((a, r) => a + (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 86_400_000, 0) / resolvedRows.length)
    : 0;
  const openRows = rows.filter((r) => r.status !== "won" && r.status !== "lost");
  const atRisk = openRows.filter((r) => {
    const s = firstResponseSla(r, sla.firstResponseHours).state;
    const t = resolutionSla(r, sla.resolveDays).state;
    return s === "at_risk" || s === "breached" || t === "at_risk" || t === "breached";
  }).length;

  // service demand (requests whose services array contains the service)
  const serviceRows = await db.select({ name: services.name }).from(services);
  const byService = serviceRows
    .map((s) => ({ name: s.name, count: rows.filter((r) => (r.services ?? []).includes(s.name)).length }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const maxService = Math.max(1, ...byService.map((s) => s.count));

  // payments (finance) — gated by payments:view
  const showPayments = can(user.role, "payments:view");
  let pay = { collected: 0, outstanding: 0, overdue: 0, pending: 0, contractValue: 0, progress: 0 };
  let attention: { id: number; label: string; project: string; amount: number; state: string; days: number | null }[] = [];
  if (showPayments) {
    const payRows = await db.select().from(payments);
    const projRows = await db.select({ id: projects.id, name: projects.name, contractValue: projects.contractValue }).from(projects);
    const pjName = new Map(projRows.map((p) => [p.id, p.name]));
    const s = summarize(payRows, projRows.reduce((a, p) => a + p.contractValue, 0));
    pay = { collected: s.collected, outstanding: s.outstanding, overdue: s.overdue, pending: s.pending, contractValue: s.contractValue, progress: s.progress };
    attention = payRows
      .map((p) => ({ p, st: paymentState(p) }))
      .filter(({ st }) => st.state === "overdue" || st.state === "pending")
      .sort((a, b) => (a.st.daysTillDue ?? 0) - (b.st.daysTillDue ?? 0))
      .slice(0, 6)
      .map(({ p, st }) => ({ id: p.id, label: p.label, project: p.projectId ? pjName.get(p.projectId) ?? "" : "", amount: p.amount, state: st.state, days: st.daysTillDue }));
  }

  // source / service / user insight tables
  const showInsights = can(user.role, "analytics:view");
  const sources = sourceInsights(rows);
  const maxSource = Math.max(1, ...sources.map((s) => s.requests));
  const serviceTable = serviceInsights(rows, serviceRows.map((s) => s.name));
  const team = showInsights ? userInsights(rows, us) : [];

  return (
    <>
      <PageHeader
        eyebrow={isAgent ? "Your performance" : "Overview"}
        title={isAgent ? `Hello, ${user.name.split(" ")[0]}` : "Performance dashboard"}
        sub={isAgent ? "Your assigned pipeline and recent activity." : "Pipeline health, traffic sources, service demand and team performance."}
        actions={showInsights ? <ExportMenu /> : undefined}
      />

      <div className="space-y-5 p-6 lg:p-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label={isAgent ? "Assigned to you" : "Total requests"} value={total} />
          <StatTile label="Open pipeline" value={open} hint={`${unassigned} unassigned`} />
          <StatTile label="Won rate" value={`${wonRate}%`} hint={`${won} won · ${lost} lost`} />
          <StatTile label="This month" value={monthCount} hint="new requests" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile label="First-response SLA" value={`${frCompliance}%`} hint={`${sla.firstResponseHours}h target · met on time`} />
          <StatTile label="Avg resolution" value={avgResolveDays ? `${avgResolveDays.toFixed(1)}d` : "—"} hint={`${sla.resolveDays}d target`} />
          <StatTile label="Needs attention" value={atRisk} hint="open requests at-risk or breached" />
        </div>

        {showPayments && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Payments collected" value={fmtEGP(pay.collected)} hint={`${pay.progress}% of ${fmtEGP(pay.contractValue)}`} />
              <StatTile label="Outstanding" value={fmtEGP(pay.outstanding)} />
              <StatTile label="Overdue" value={fmtEGP(pay.overdue)} hint="past due, unpaid" />
              <StatTile label="Pending verification" value={fmtEGP(pay.pending)} hint="receipts to check" />
            </div>
            {attention.length > 0 && (
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <h2 className="text-sm font-bold">Payments needing attention</h2>
                  <Link href="/payments" className="text-xs font-bold text-olive hover:text-ink">Open payments →</Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <tbody>
                      {attention.map((a) => (
                        <tr key={a.id} className="border-t border-line hover:bg-sand/30">
                          <td className="px-5 py-2.5 font-semibold">{a.label}<div className="text-xs text-muted">{a.project}</div></td>
                          <td className="px-3 py-2.5 font-bold tabular">{fmtEGP(a.amount)}</td>
                          <td className="px-5 py-2.5 text-right">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${a.state === "overdue" ? "bg-crit/10 text-crit" : "bg-info/10 text-info"}`}>
                              {a.state === "overdue" ? `Overdue ${a.days != null ? Math.abs(a.days) + "d" : ""}` : "Pending verification"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <h2 className="text-sm font-bold">Pipeline</h2>
            <p className="text-xs text-sub">Requests by stage</p>
            <div className="mt-4 space-y-2.5">
              {byStatus.map((b) => (
                <div key={b.status} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-right text-xs font-semibold text-sub">
                    {STATUS_META[b.status].label}
                  </div>
                  <div className="h-6 flex-1 overflow-hidden rounded-md bg-sand">
                    <div
                      className={`h-full rounded-md ${STATUS_META[b.status].dot}`}
                      style={{ width: `${(b.count / maxStatus) * 100}%`, minWidth: b.count ? "8px" : 0 }}
                    />
                  </div>
                  <div className="w-8 text-right text-sm font-bold tabular">{b.count}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-bold">Intake · last 8 weeks</h2>
            <p className="text-xs text-sub">New requests per week</p>
            <div className="mt-5 flex h-40 items-end gap-1.5">
              {weeks.map((w, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-ink"
                      style={{ height: `${(w.count / maxWeek) * 100}%`, minHeight: w.count ? "6px" : "2px" }}
                      title={`${w.count}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted tabular">{w.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-sm font-bold">Demand by style</h2>
            <div className="mt-4 space-y-2.5">
              {byStyle.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-32 shrink-0 truncate text-xs font-semibold text-sub">{s.name}</div>
                  <div className="h-5 flex-1 overflow-hidden rounded-md bg-sand">
                    <div className="h-full rounded-md bg-olive" style={{ width: `${(s.count / maxStyle) * 100}%`, minWidth: s.count ? "8px" : 0 }} />
                  </div>
                  <div className="w-8 text-right text-sm font-bold tabular">{s.count}</div>
                </div>
              ))}
            </div>
          </Card>

          {!isAgent && (
            <Card className="p-5">
              <h2 className="text-sm font-bold">Team load</h2>
              <p className="text-xs text-sub">Open requests per person</p>
              <div className="mt-4 space-y-2.5">
                {load.map((l) => (
                  <div key={l.name} className="flex items-center gap-3">
                    <div className="flex w-36 shrink-0 items-center gap-2">
                      <Avatar name={l.name} />
                      <span className="truncate text-xs font-semibold text-sub">{l.name}</span>
                    </div>
                    <div className="h-5 flex-1 overflow-hidden rounded-md bg-sand">
                      <div className="h-full rounded-md bg-lime" style={{ width: `${(l.count / maxLoad) * 100}%`, minWidth: l.count ? "8px" : 0 }} />
                    </div>
                    <div className="w-8 text-right text-sm font-bold tabular">{l.count}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {byService.length > 0 && (
          <Card className="p-5">
            <h2 className="text-sm font-bold">Service demand</h2>
            <p className="text-xs text-sub">Requests asking for each service</p>
            <div className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {byService.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-32 shrink-0 truncate text-xs font-semibold text-sub">{s.name}</div>
                  <div className="h-5 flex-1 overflow-hidden rounded-md bg-sand">
                    <div className="h-full rounded-md bg-ink" style={{ width: `${(s.count / maxService) * 100}%`, minWidth: s.count ? "8px" : 0 }} />
                  </div>
                  <div className="w-8 text-right text-sm font-bold tabular">{s.count}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Traffic sources — KPIs applied per source */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4">
            <h2 className="text-sm font-bold">Traffic sources</h2>
            <p className="text-xs text-sub">Where requests come from, with KPIs per source</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-y border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-2.5 font-bold">Source</th>
                  <th className="px-3 py-2.5 font-bold">Requests</th>
                  <th className="px-3 py-2.5 font-bold">Won</th>
                  <th className="px-3 py-2.5 font-bold">Won rate</th>
                  <th className="px-3 py-2.5 font-bold">Avg 1st response</th>
                  <th className="px-5 py-2.5 font-bold">Avg resolution</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.channel} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-24 shrink-0 truncate font-semibold">{s.channel}</span>
                        <span className="hidden h-2 w-28 overflow-hidden rounded-full bg-sand sm:block">
                          <span className="block h-full rounded-full bg-olive" style={{ width: `${(s.requests / maxSource) * 100}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-bold tabular">{s.requests}</td>
                    <td className="px-3 py-2.5 tabular">{s.won}</td>
                    <td className="px-3 py-2.5 tabular">{s.wonRate}%</td>
                    <td className="px-3 py-2.5 text-sub tabular">{s.avgFirstResponseH ? `${s.avgFirstResponseH.toFixed(0)}h` : "—"}</td>
                    <td className="px-5 py-2.5 text-sub tabular">{s.avgResolveDays ? `${s.avgResolveDays.toFixed(1)}d` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Requests per service type */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4"><h2 className="text-sm font-bold">Requests by service type</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-5 py-2.5 font-bold">Service</th>
                    <th className="px-3 py-2.5 font-bold">Requests</th>
                    <th className="px-3 py-2.5 font-bold">Won</th>
                    <th className="px-5 py-2.5 font-bold">Won rate</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceTable.map((s) => (
                    <tr key={s.service} className="border-b border-line last:border-0 hover:bg-sand/30">
                      <td className="px-5 py-2.5 font-semibold">{s.service}</td>
                      <td className="px-3 py-2.5 font-bold tabular">{s.requests}</td>
                      <td className="px-3 py-2.5 tabular">{s.won}</td>
                      <td className="px-5 py-2.5 tabular">{s.wonRate}%</td>
                    </tr>
                  ))}
                  {serviceTable.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-muted">No services requested yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Team / user insights */}
          {showInsights && (
            <Card className="overflow-hidden">
              <div className="px-5 py-4"><h2 className="text-sm font-bold">Team performance</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                      <th className="px-5 py-2.5 font-bold">Person</th>
                      <th className="px-3 py-2.5 font-bold">Open</th>
                      <th className="px-3 py-2.5 font-bold">Won</th>
                      <th className="px-3 py-2.5 font-bold">Won rate</th>
                      <th className="px-5 py-2.5 font-bold">Avg resolve</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((u) => (
                      <tr key={u.name} className="border-b border-line last:border-0 hover:bg-sand/30">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar name={u.name} />
                            <div>
                              <div className="font-semibold">{u.name}</div>
                              <div className="text-xs text-muted">{u.roleLabel}{u.active ? "" : " · disabled"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-bold tabular">{u.assignedOpen}</td>
                        <td className="px-3 py-2.5 tabular">{u.won}</td>
                        <td className="px-3 py-2.5 tabular">{u.wonRate}%</td>
                        <td className="px-5 py-2.5 text-sub tabular">{u.avgResolveDays ? `${u.avgResolveDays.toFixed(1)}d` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-bold">Recent requests</h2>
            <Link href="/requests" className="text-xs font-bold text-olive hover:text-ink">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-2.5 font-bold">Ref</th>
                  <th className="px-3 py-2.5 font-bold">Contact</th>
                  <th className="px-3 py-2.5 font-bold">Location</th>
                  <th className="px-3 py-2.5 font-bold">Style</th>
                  <th className="px-3 py-2.5 font-bold">Owner</th>
                  <th className="px-5 py-2.5 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <Link href={`/requests/${r.id}`} className="font-bold text-ink hover:text-olive">{r.ref}</Link>
                    </td>
                    <td className="px-3 py-3">{r.contactName}</td>
                    <td className="px-3 py-3 text-sub">{r.location}</td>
                    <td className="px-3 py-3 text-sub">{r.style ? styleName.get(r.style) ?? r.style : "—"}</td>
                    <td className="px-3 py-3 text-sub">{r.assignedTo ? nameOf.get(r.assignedTo) : "—"}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
