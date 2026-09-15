import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { proposals, requestNotes } from "@/lib/db/schema";
import { notify, notifyRoles } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// Public, token-gated: the marketing site's hidden proposal page fetches this by
// the unguessable token. No auth — the token IS the credential. CORS-open so the
// static site (a different origin) can read it.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** Only client-facing fields ever leave the server — never the token, ids or internals. */
function publicShape(p: typeof proposals.$inferSelect) {
  return {
    title: p.title,
    clientName: p.clientName,
    status: p.status,
    intro: p.intro,
    direction: {
      styleName: p.styleName,
      palette: p.palette,
      note: p.directionNote,
      images: (p.images ?? []).map((im) =>
        typeof im === "string" ? { url: im } : { url: im.url, title: im.title },
      ),
    },
    scope: {
      items: p.scopeItems ?? [],
      priceLabel: p.priceLabel,
      financingNote: p.financingNote,
    },
    timeline: {
      items: p.timelineItems ?? [],
      note: p.timelineNote,
    },
    cta: {
      type: p.ctaType,
      label: p.ctaLabel,
      value: p.ctaValue,
    },
  };
}

async function load(token: string) {
  if (!token || token.length < 24 || token.length > 80) return null;
  const db = await getDb();
  const [row] = await db.select().from(proposals).where(eq(proposals.token, token)).limit(1);
  return row ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await load(token);
  if (!row || row.status === "archived") {
    return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
  }

  // First open marks it viewed (and notifies the author once).
  if (!row.viewedAt) {
    const db = await getDb();
    await db
      .update(proposals)
      .set({ viewedAt: new Date(), status: row.status === "sent" ? "viewed" : row.status })
      .where(eq(proposals.id, row.id));
    if (row.createdBy) {
      await notify(row.createdBy, {
        type: "proposal.viewed",
        title: `Proposal opened — ${row.title}`,
        body: row.clientName ?? undefined,
        entity: "proposal",
        entityId: row.id,
        href: `/proposals/${row.id}`,
      });
    }
  }

  return Response.json(publicShape(row), { status: 200, headers: CORS });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rl = await rateLimit(`proposal:${clientIp(req.headers)}`, 10, 60_000);
  if (!rl.ok) return Response.json({ error: "Too many requests" }, { status: 429, headers: CORS });

  const row = await load(token);
  if (!row || row.status === "archived") {
    return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
  }

  let body: { action?: string; message?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS });
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  const ACTIONS = {
    approve: { status: "approved" as const, verb: "approved", needsMessage: false },
    changes: { status: "changes_requested" as const, verb: "requested changes to", needsMessage: true },
    reject: { status: "rejected" as const, verb: "declined", needsMessage: false },
  };
  const spec = ACTIONS[body.action as keyof typeof ACTIONS];
  if (!spec) return Response.json({ error: "Unknown action" }, { status: 400, headers: CORS });
  if (spec.needsMessage && !message) {
    return Response.json({ error: "Please describe the change you'd like." }, { status: 422, headers: CORS });
  }

  const db = await getDb();
  const now = new Date();
  await db
    .update(proposals)
    .set({
      status: spec.status,
      updatedAt: now,
      ...(spec.status === "approved" ? { approvedAt: now } : { respondedAt: now }),
      ...(message ? { responseNote: message } : {}),
    })
    .where(eq(proposals.id, row.id));

  await logActivity(null, `proposal.${spec.status}`, "proposal", String(row.id), { via: "client" });

  // Mirror onto the linked request's timeline.
  if (row.requestId) {
    await db.insert(requestNotes).values({
      requestId: row.requestId,
      authorId: null,
      kind: "status",
      body: `Client ${spec.verb} the proposal "${row.title}".` + (message ? `\n“${message}”` : ""),
    });
  }

  const title = `Proposal ${spec.status === "changes_requested" ? "— changes requested" : spec.verb} — ${row.title}`;
  const notifBody = [row.clientName, message].filter(Boolean).join(" · ") || undefined;
  const payload = { type: `proposal.${spec.status}`, title, body: notifBody, entity: "proposal", entityId: row.id, href: `/proposals/${row.id}` };
  if (row.createdBy) await notify(row.createdBy, payload);
  await notifyRoles(["ops_manager", "admin"], payload, row.createdBy ?? undefined);

  return Response.json({ ok: true, status: spec.status }, { status: 200, headers: CORS });
}
