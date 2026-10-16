import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { activityLog, flppEvents, projects, projectUpdates, projectMedia, payments, requests } from "@/lib/db/schema";
import { notify } from "@/lib/notifications";

// Receives FLPP → Turnkii events and maps them onto the customer-facing project
// (updates, media, payments, stage). Every event is logged for audit and
// deduped by its own id; the project is resolved from the FLPP ticket ref, or
// from the originating request ref carried in the payload. Supplier-side money
// events (payment.released, po.*) are audited only — that detail stays in FLPP.
function authed(req: Request): boolean {
  const token = process.env.FLPP_API_TOKEN;
  return !!token && req.headers.get("authorization") === `Bearer ${token}`;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : 0; };
const clampPct = (v: unknown): number => Math.max(0, Math.min(100, num(v)));
// Who in FLPP produced this event — stored on the synced update for attribution.
const actorOf = (p: Record<string, unknown>): string | null => {
  const a = p.actor;
  if (typeof a === "string") return a || null;
  if (a && typeof a === "object") {
    const o = a as { role?: string; name?: string };
    return [o.role, o.name].filter(Boolean).join(" · ") || null;
  }
  return null;
};

type Project = typeof projects.$inferSelect;

async function ingest(
  db: Awaited<ReturnType<typeof getDb>>,
  project: Project,
  name: string,
  payload: Record<string, unknown>,
  ticketRef: string | null,
): Promise<void> {
  const pid = project.id;
  const flppActor = actorOf(payload);
  switch (name) {
    case "ticket.opened": {
      if (ticketRef && !project.flppTicketRef) {
        await db.update(projects).set({ flppTicketRef: ticketRef, updatedAt: new Date() }).where(eq(projects.id, pid));
        // Acknowledge the handoff: tell the request's owner FLPP has opened execution.
        if (project.requestId) {
          const [r] = await db.select({ assignedTo: requests.assignedTo, ref: requests.ref }).from(requests).where(eq(requests.id, project.requestId)).limit(1);
          if (r?.assignedTo) {
            await notify(r.assignedTo, {
              type: "flpp.ticket_opened", title: `FLPP opened execution · ${r.ref}`,
              body: `Ticket ${ticketRef} is live for ${project.name}.`,
              entity: "project", entityId: pid, href: `/projects/${pid}`,
            });
          }
        }
      }
      break;
    }
    case "scope.locked": {
      await db.update(projects).set({ stage: "scope_locked", updatedAt: new Date() }).where(eq(projects.id, pid));
      await db.insert(projectUpdates).values({
        projectId: pid, flppActor, title: "Scope locked", kind: "note",
        body: "Design approved — scope locked and handed to execution.", visibleToOwner: true,
      });
      break;
    }
    case "project.progress": {
      const pct = clampPct(payload.pct);
      const milestone = str(payload.milestone) || "Progress update";
      const [u] = await db.insert(projectUpdates).values({
        projectId: pid, flppActor, title: milestone, body: str(payload.note) || milestone,
        kind: "progress", stage: str(payload.stage) || null, visibleToOwner: true,
      }).returning();
      const media = Array.isArray(payload.media) ? payload.media : [];
      for (let i = 0; i < media.length; i++) {
        const m = media[i] as string | { url?: string; type?: string; caption?: string };
        const url = typeof m === "string" ? m : str(m?.url);
        if (!url) continue;
        await db.insert(projectMedia).values({
          updateId: u.id, type: (typeof m === "object" && m?.type === "video") ? "video" : "photo",
          url, caption: typeof m === "object" ? (str(m?.caption) || null) : null, sort: i,
        });
      }
      await db.update(projects).set({
        pctComplete: pct, stage: pct >= 100 ? "certifying" : "in_execution", updatedAt: new Date(),
      }).where(eq(projects.id, pid));
      break;
    }
    case "work.certified": {
      const label = str(payload.milestone) || "Milestone certified";
      const amount = num(payload.amount);
      const [u] = await db.insert(projectUpdates).values({
        projectId: pid, flppActor, title: label, body: `Milestone certified: ${label}`,
        kind: "milestone", milestone: label, amount, visibleToOwner: true,
      }).returning();
      // Raise the client's instalment for this milestone, once (idempotent by label).
      const [existingPay] = await db.select({ id: payments.id }).from(payments)
        .where(and(eq(payments.projectId, pid), eq(payments.label, label))).limit(1);
      if (!existingPay && amount > 0) {
        const [p] = await db.insert(payments).values({
          projectId: pid, kind: "milestone", label, amount, status: "pending",
        }).returning();
        await db.update(projectUpdates).set({ paymentId: p.id }).where(eq(projectUpdates.id, u.id));
      }
      await db.update(projects).set({ stage: "certifying", updatedAt: new Date() }).where(eq(projects.id, pid));
      break;
    }
    case "variation.approved": {
      const delta = num(payload.costDelta);
      const desc = str(payload.description) || "Variation approved";
      if (payload.bearer === "client" && delta) {
        await db.update(projects).set({ contractValue: sql`${projects.contractValue} + ${delta}`, updatedAt: new Date() }).where(eq(projects.id, pid));
      }
      await db.insert(projectUpdates).values({
        projectId: pid, flppActor, title: "Variation approved", kind: "note",
        body: delta ? `${desc} (EGP ${delta.toLocaleString("en-US")})` : desc, visibleToOwner: true,
      });
      break;
    }
    case "issue.escalated": {
      await db.insert(projectUpdates).values({
        projectId: pid, flppActor, title: "Issue escalated", kind: "note",
        body: str(payload.issue) || "An issue was escalated on site.", visibleToOwner: false,
      });
      break;
    }
    case "handover.ready": {
      await db.update(projects).set({ stage: "handover", pctComplete: 100, updatedAt: new Date() }).where(eq(projects.id, pid));
      await db.insert(projectUpdates).values({
        projectId: pid, flppActor, title: "Ready for handover", kind: "note",
        body: str(payload.note) || "Works complete — your home is ready for handover. Final sign-off and your handover pack follow.",
        visibleToOwner: true,
      });
      break;
    }
    // payment.released, po.delivered, po.shortfall, …: supplier-side — audit only.
    default:
      break;
  }
}

export async function POST(req: Request) {
  if (!authed(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { name?: string; ticketRef?: string; eventId?: string; payload?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.name) return Response.json({ error: "name required" }, { status: 400 });

  const db = await getDb();
  const payload = body.payload ?? {};
  const ticketRef = body.ticketRef ?? null;

  // Audit (unchanged behaviour).
  await db.insert(activityLog).values({
    userId: null, action: `flpp:${body.name}`, entity: "flpp_event", entityId: ticketRef, meta: payload,
  });

  // Dedupe replays by the event's own id.
  const eventId = str(body.eventId) || str(payload.eventId) || null;
  if (eventId) {
    const [seen] = await db.select({ id: flppEvents.id }).from(flppEvents).where(eq(flppEvents.eventId, eventId)).limit(1);
    if (seen) return Response.json({ ok: true, deduped: true });
  }

  // Resolve the project: by FLPP ticket ref, else by the originating request ref.
  let project: Project | undefined;
  if (ticketRef) {
    [project] = await db.select().from(projects).where(eq(projects.flppTicketRef, ticketRef)).limit(1);
  }
  if (!project && str(payload.originationRef)) {
    [project] = await db.select().from(projects).where(eq(projects.requestRef, str(payload.originationRef))).limit(1);
  }

  // Map onto the project — best-effort so a bad event never fails the webhook.
  if (project) {
    try { await ingest(db, project, body.name, payload, ticketRef); }
    catch (e) { console.error("flpp ingest failed", body.name, e); }
  }

  await db.insert(flppEvents).values({
    eventId, name: body.name, ticketRef, projectId: project?.id ?? null, payload,
  });

  return Response.json({ ok: true, projectId: project?.id ?? null, matched: !!project });
}
