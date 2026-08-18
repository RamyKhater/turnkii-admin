import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guard";
import { canAccessSection, can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { requests, requestNotes, users, styles } from "@/lib/db/schema";
import { PageHeader, Card, StatusBadge, Avatar } from "@/components/ui";
import { StatusControl, AssignControl, NoteForm } from "@/components/requests/controls";
import { firstResponseSla, resolutionSla, SLA_STYLE } from "@/lib/sla";
import { getSiteConfig } from "@/lib/settings";

const PRIORITY: Record<string, string> = {
  high: "bg-crit/10 text-crit", normal: "bg-sand text-sub", low: "bg-info/10 text-info",
};

const KIND_LABEL: Record<string, string> = {
  note: "Note", call: "Call", survey: "Survey", status: "Update",
};

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!canAccessSection(user.role, "requests")) redirect("/denied");
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) notFound();

  const db = await getDb();
  const [req] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!req) notFound();

  // Agents can only open their own requests.
  if (user.role === "agent" && req.assignedTo !== user.id) redirect("/requests");

  const us = await db.select({ id: users.id, name: users.name, role: users.role }).from(users);
  const nameOf = new Map(us.map((u) => [u.id, u.name]));
  const owners = us.filter((u) => u.role === "agent" || u.role === "ops_manager");
  const styleRows = await db.select({ key: styles.key, name: styles.name }).from(styles);
  const styleName = new Map(styleRows.map((s) => [s.key, s.name]));

  const notes = await db
    .select()
    .from(requestNotes)
    .where(eq(requestNotes.requestId, id))
    .orderBy(desc(requestNotes.createdAt));

  const { sla } = await getSiteConfig();
  const fr = firstResponseSla(req, sla.firstResponseHours);
  const rs = resolutionSla(req, sla.resolveDays);

  const owns = user.role !== "agent" || req.assignedTo === user.id;
  const canUpdate = can(user.role, "requests:update") && owns;
  const canAssign = can(user.role, "requests:assign");
  const canNote = can(user.role, "requests:note") && owns;

  const facts: [string, React.ReactNode][] = [
    ["Property", `${req.propertyType ?? "—"} · ${req.area ?? "?"}m² · ${req.units ?? 1} unit${req.units === 1 ? "" : "s"}`],
    ["Location", req.location ?? "—"],
    ["Style", req.style ? styleName.get(req.style) ?? req.style : "—"],
    ["Services", req.services?.length ? req.services.join(", ") : "—"],
    ["Financing", req.budgetPlan ?? "—"],
    ["Traffic source", req.channel ?? "—"],
    ["Origin", <span key="s" className="capitalize">{req.source}</span>],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Request"
        title={`${req.ref}`}
        sub={`Received ${req.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`}
        actions={<Link href="/requests" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← All requests</Link>}
      />

      <div className="grid gap-5 p-6 lg:grid-cols-3 lg:p-8">
        {/* Left: details + timeline */}
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">{req.contactName}</h2>
                <p className="mt-1 text-sm text-sub">
                  <a href={`tel:${req.phone}`} className="hover:text-ink">{req.phone}</a>
                  {req.email && <> · <a href={`mailto:${req.email}`} className="hover:text-ink">{req.email}</a></>}
                </p>
              </div>
              <StatusBadge status={req.status} />
            </div>
            <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-bold uppercase tracking-wider text-muted">{k}</dt>
                  <dd className="mt-0.5 text-sm text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {req.message && (
              <div className="mt-5 rounded-xl bg-sand/50 p-4 text-sm text-sub">{req.message}</div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-bold">Activity timeline</h2>
            {canNote ? (
              <div className="mt-4"><NoteForm id={id} /></div>
            ) : (
              <p className="mt-2 text-xs text-muted">You have read-only access to this request.</p>
            )}
            <ol className="mt-6 space-y-4">
              {notes.map((n) => (
                <li key={n.id} className="flex gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="h-2 w-2 rounded-full bg-olive" />
                    <span className="mt-1 w-px flex-1 bg-line" />
                  </div>
                  <div className="pb-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="rounded-full bg-sand px-2 py-0.5 font-bold uppercase tracking-wider text-sub">{KIND_LABEL[n.kind] ?? n.kind}</span>
                      <span>{n.authorId ? nameOf.get(n.authorId) : "System"}</span>
                      <span>· {n.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink">{n.body}</p>
                  </div>
                </li>
              ))}
              {notes.length === 0 && <li className="text-sm text-muted">No activity yet.</li>}
            </ol>
          </Card>
        </div>

        {/* Right: controls */}
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-sm font-bold">Status</h2>
            <div className="mt-3">
              {canUpdate ? (
                <StatusControl id={id} current={req.status} />
              ) : (
                <StatusBadge status={req.status} />
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-bold">Priority</h2>
            <div className="mt-3">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${PRIORITY[req.priority] ?? PRIORITY.normal}`}>
                {req.priority}
              </span>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-bold">SLA</h2>
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted">First response</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${SLA_STYLE[fr.state].chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${SLA_STYLE[fr.state].dot}`} />
                    {SLA_STYLE[fr.state].label}
                  </span>
                  <span className="text-xs text-sub">{fr.label}</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted">Resolution</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${SLA_STYLE[rs.state].chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${SLA_STYLE[rs.state].dot}`} />
                    {SLA_STYLE[rs.state].label}
                  </span>
                  <span className="text-xs text-sub">{rs.label}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-bold">Owner</h2>
            <div className="mt-3">
              {canAssign ? (
                <AssignControl id={id} current={req.assignedTo} owners={owners} />
              ) : req.assignedTo ? (
                <span className="inline-flex items-center gap-2 text-sm">
                  <Avatar name={nameOf.get(req.assignedTo) ?? "?"} />
                  {nameOf.get(req.assignedTo)}
                </span>
              ) : (
                <span className="text-sm font-semibold text-warn">Unassigned</span>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
