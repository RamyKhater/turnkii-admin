import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, asc, desc, inArray } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { projects, payments, properties, projectUpdates, projectMedia, projectSignoffs, projectHandovers, variations, styles, surveyFiles, flppEvents } from "@/lib/db/schema";
import { PageHeader, Card, StatTile } from "@/components/ui";
import { fmtEGP, summarize, KIND_LABEL } from "@/lib/payments";
import { PaymentActions, PaymentStateBadge, AddPaymentForm } from "@/components/payments/controls";
import { ProjectForm } from "@/components/projects/project-form";
import { updateProject, publishHandoverShowcaseAction } from "@/lib/projects/actions";
import { SendUpdateForm } from "@/components/projects/send-update";
import { ProgressTimeline, type TLUpdate } from "@/components/projects/progress-timeline";
import { TasksPanel } from "@/components/tasks/tasks-panel";

const MEDIA_LIBRARY = [
  { url: "https://turnkii.app/assets/style-warm.jpg", label: "Living room" },
  { url: "https://turnkii.app/assets/style-neoclassic.png", label: "Reception" },
  { url: "https://turnkii.app/assets/style-majlis.jpg", label: "Majlis" },
  { url: "https://turnkii.app/assets/style-eclectic.jpg", label: "Bedroom" },
  { url: "https://turnkii.app/assets/style-coastal.jpg", label: "Terrace" },
];

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCap("payments:view");
  const manage = can(user.role, "payments:manage");
  const canRecord = can(user.role, "payments:record");
  const canVerify = can(user.role, "payments:verify");
  const { id } = await params;
  const db = await getDb();
  const [pr] = await db.select().from(projects).where(eq(projects.id, Number(id))).limit(1);
  if (!pr) notFound();
  const [prop] = pr.propertyId ? await db.select().from(properties).where(eq(properties.id, pr.propertyId)).limit(1) : [null];
  const schedule = await db.select().from(payments).where(eq(payments.projectId, pr.id)).orderBy(asc(payments.dueDate));
  const sum = summarize(schedule, pr.contractValue);
  const canProgress = can(user.role, "projects:manage");
  const updates = await db.select().from(projectUpdates).where(eq(projectUpdates.projectId, pr.id)).orderBy(desc(projectUpdates.createdAt));
  // Cross-system timeline: the FLPP events ingested for this project + a deep link to the ticket.
  const events = await db.select().from(flppEvents).where(eq(flppEvents.projectId, pr.id)).orderBy(desc(flppEvents.receivedAt)).limit(40);
  const flppBase = (process.env.FLPP_API_URL ?? "").replace(/\/$/, "");
  const flppTicketUrl = flppBase && pr.flppTicketRef ? `${flppBase}/tickets/${pr.flppTicketRef}` : null;
  const updateIds = updates.map((u) => u.id);
  const media = updateIds.length ? await db.select().from(projectMedia).where(inArray(projectMedia.updateId, updateIds)).orderBy(asc(projectMedia.sort)) : [];
  const signoffs = updateIds.length ? await db.select().from(projectSignoffs).where(inArray(projectSignoffs.updateId, updateIds)) : [];
  const surveyDocs = await db.select().from(surveyFiles).where(eq(surveyFiles.projectId, pr.id)).orderBy(desc(surveyFiles.createdAt));
  // Seam wave 2: variations (F5) + handover pack (F6/F9) for this project.
  const vos = await db.select().from(variations).where(eq(variations.projectId, pr.id)).orderBy(desc(variations.createdAt));
  const [handover] = await db.select().from(projectHandovers).where(eq(projectHandovers.projectId, pr.id)).limit(1);
  // F7 reconciliation: client collected vs FLPP figures (under/over collection).
  const recon = pr.financeSyncedAt ? {
    collected: sum.collected, certified: pr.flppCertified, committed: pr.flppCommitted,
    paid: pr.flppPaid, retention: pr.flppRetention, delta: sum.collected - pr.flppPaid,
  } : null;
  const dateShort = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const mediaByU = new Map<number, typeof media>();
  for (const m of media) { const a = mediaByU.get(m.updateId) ?? []; a.push(m); mediaByU.set(m.updateId, a); }
  const soByU = new Map(signoffs.map((s) => [s.updateId, s]));
  const timeline: TLUpdate[] = updates
    .filter((u) => (mediaByU.get(u.id) ?? []).length > 0)
    .map((u) => {
      const so = soByU.get(u.id);
      return {
        id: u.id, stage: u.stage ?? u.title, milestone: u.milestone, body: u.body, amount: u.amount ?? 0,
        sentAtISO: (u.sentAt ?? u.createdAt).toISOString(),
        media: (mediaByU.get(u.id) ?? []).map((m) => ({
          id: m.id, type: m.type, url: m.url, caption: m.caption, status: m.status,
          reason: m.reason, comment: m.comment, aiCaption: m.aiCaption, aiFlags: m.aiFlags ?? null,
        })),
        signoff: so ? {
          id: so.id, ref: so.ref, signedByName: so.signedByName, signedByRole: so.signedByRole,
          signedAtISO: so.signedAt.toISOString(), voidedAtISO: so.voidedAt ? so.voidedAt.toISOString() : null,
          itemCount: so.itemCount, method: so.method, amount: so.amount,
        } : null,
      };
    });
  const propRows = manage ? await db.select({ id: properties.id, name: properties.name }).from(properties).orderBy(asc(properties.name)) : [];
  const styleRows = manage ? await db.select({ key: styles.key, name: styles.name }).from(styles).orderBy(asc(styles.sortOrder)) : [];

  return (
    <>
      <PageHeader
        eyebrow="Project"
        title={pr.name}
        sub={`${pr.stage.replace(/_/g, " ")}${pr.pctComplete ? ` · ${pr.pctComplete}% complete` : ""}${pr.flppTicketRef ? ` · ${pr.flppTicketRef}` : ""}${prop ? ` · ${prop.name}` : ""}`}
        actions={<Link href="/projects" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Projects</Link>}
      />
      <div className="space-y-5 p-6 lg:p-8">
        {pr.riskFlag && (
          <Card className="border-crit/40 bg-crit-soft/40 p-4">
            <div className="flex items-start gap-3">
              <span className="text-lg text-crit" aria-hidden>⚠</span>
              <div>
                <div className="text-sm font-bold text-crit">At risk</div>
                <div className="text-sm text-ink">{pr.riskFlag}{pr.riskAt ? ` · flagged ${new Date(pr.riskAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}` : ""}</div>
              </div>
            </div>
          </Card>
        )}
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

        {/* F1 — "cleared to build" gate: both facts must hold before FLPP releases procurement. */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">Cleared to build</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pr.buildClearedAt ? "bg-olive/15 text-olive" : "bg-sand text-muted"}`}>
              {pr.buildClearedAt ? `Cleared ${dateShort(pr.buildClearedAt)}` : "Not cleared"}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <span aria-hidden>{pr.sowApprovedAt ? "✓" : "○"}</span>
              <span className={pr.sowApprovedAt ? "text-ink" : "text-muted"}>Customer SoW accepted{pr.sowApprovedAt ? ` · ${dateShort(pr.sowApprovedAt)}` : ""}</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden>{["scope_locked","in_execution","certifying","handover","complete"].includes(pr.stage) ? "✓" : "○"}</span>
              <span className={["scope_locked","in_execution","certifying","handover","complete"].includes(pr.stage) ? "text-ink" : "text-muted"}>Scope locked by design (FLPP)</span>
            </li>
          </ul>
          {!pr.buildClearedAt && <p className="mt-3 text-xs text-muted">FLPP holds procurement and delivery until both are true.</p>}
        </Card>

        {/* F5 — client-borne variations awaiting / decided by the customer. */}
        {vos.length > 0 && (
          <Card className="p-5">
            <h2 className="text-sm font-bold">Variations</h2>
            <p className="text-xs text-sub">Client-borne changes the customer approves in their account before the contract value moves.</p>
            <ul className="mt-3 divide-y divide-line">
              {vos.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0"><span className="font-semibold">{v.ref}</span> · {v.description}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="font-bold tabular">{fmtEGP(v.amount)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${v.status === "accepted" ? "bg-olive/15 text-olive" : v.status === "declined" ? "bg-crit-soft text-crit" : "bg-sand text-muted"}`}>
                      {v.status === "pending" ? "Awaiting customer" : v.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* F7 — per-project money reconciliation (client collections vs FLPP figures). */}
        {recon && (
          <Card className="p-5">
            <h2 className="text-sm font-bold">Reconciliation</h2>
            <p className="text-xs text-sub">Client collections against FLPP execution figures{pr.financeSyncedAt ? ` · synced ${dateShort(pr.financeSyncedAt)}` : ""}.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Client collected" value={fmtEGP(recon.collected)} />
              <StatTile label="FLPP certified" value={fmtEGP(recon.certified)} />
              <StatTile label="FLPP paid out" value={fmtEGP(recon.paid)} hint={recon.retention ? `${fmtEGP(recon.retention)} retention` : undefined} />
              <StatTile label={recon.delta >= 0 ? "Net collected" : "Under-collected"} value={fmtEGP(Math.abs(recon.delta))} />
            </div>
            {recon.delta < 0 && <p className="mt-3 text-xs font-semibold text-crit">Under-collected vs money paid out to trades — raise the next instalment.</p>}
          </Card>
        )}

        {/* F6 / F9 — handover pack, sign-off state, delivering-party credit + publish to showcase. */}
        {handover && (
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold">Handover pack</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${handover.status === "signed" ? "bg-olive/15 text-olive" : "bg-sand text-muted"}`}>
                {handover.status === "signed" ? `Signed ${handover.signedByName ? `· ${handover.signedByName}` : ""}` : "Awaiting customer sign-off"}
              </span>
            </div>
            {handover.summary && <p className="mt-2 text-sm text-ink">{handover.summary}</p>}
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {handover.deliveredByName && <div><dt className="text-xs uppercase tracking-wide text-muted">Delivered by</dt><dd className="font-semibold">{handover.deliveredByName}{handover.deliveredRating ? ` · ${handover.deliveredRating}★` : ""}</dd></div>}
              {handover.warranty && <div><dt className="text-xs uppercase tracking-wide text-muted">Warranty</dt><dd>{handover.warranty}</dd></div>}
              <div><dt className="text-xs uppercase tracking-wide text-muted">As-built media</dt><dd>{handover.media.length} item{handover.media.length === 1 ? "" : "s"}</dd></div>
            </dl>
            {manage && handover.status === "signed" && (
              <form action={publishHandoverShowcaseAction} className="mt-4">
                <input type="hidden" name="projectId" value={pr.id} />
                <button type="submit" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">
                  {handover.showcaseToken ? "Update showcase" : "Publish to Project Showcases"}
                </button>
                {handover.showcaseToken && <Link href="/project-showcases" className="ml-3 text-sm font-bold text-olive hover:text-ink">View showcase →</Link>}
              </form>
            )}
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
                    <td className="px-5 py-3 text-right">{(canRecord || canVerify) ? <PaymentActions payment={p} canRecord={canRecord} canVerify={canVerify} /> : (p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-olive">Receipt</a>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canRecord && (
            <div className="border-t border-line p-5">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Add a scheduled payment</h3>
              <AddPaymentForm projectId={pr.id} />
            </div>
          )}
        </Card>

        {canProgress && (
          <Card className="p-5 lg:p-6">
            <h2 className="text-sm font-bold">Send a progress update</h2>
            <p className="text-xs text-sub">Share photos and video with the client. Each item needs their acceptance before the milestone can be signed.</p>
            <div className="mt-4"><SendUpdateForm projectId={pr.id} library={MEDIA_LIBRARY} /></div>
          </Card>
        )}

        {surveyDocs.length > 0 && (
          <Card className="p-5 lg:p-6">
            <h2 className="text-sm font-bold">Survey outcome</h2>
            <p className="text-xs text-sub">Documents and photos captured during the site survey, carried over from the request.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {surveyDocs.map((f) => (
                <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-line p-3 hover:border-ink">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sand text-base">{(f.contentType ?? "").startsWith("image/") || f.kind === "image" ? "🖼" : "📄"}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{f.name}</span>{f.note && <span className="block truncate text-xs text-muted">{f.note}</span>}</span>
                </a>
              ))}
            </div>
          </Card>
        )}

        <TasksPanel entityType="project" entityId={pr.id} back={`/projects/${pr.id}`} />

        <div>
          <h2 className="mb-3 text-sm font-bold">Shared media &amp; client decisions</h2>
          <ProgressTimeline projectId={pr.id} updates={timeline} manage={canProgress} />

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">FLPP timeline</h2>
            {flppTicketUrl && <a href={flppTicketUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-olive hover:text-ink">View ticket {pr.flppTicketRef} →</a>}
          </div>
          {events.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No execution events from FLPP yet.</p>
          ) : (
            <ol className="mt-3 space-y-1.5">
              {events.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3 border-b border-line/50 pb-1.5 text-sm last:border-0">
                  <span className="font-mono text-xs font-semibold text-ink">{e.name}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">{new Date(e.receivedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        </div>
      </div>
    </>
  );
}
