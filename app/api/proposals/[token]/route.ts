import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { proposals } from "@/lib/db/schema";
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
      images: p.images ?? [],
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

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS });
  }

  if (body.action === "approve") {
    const db = await getDb();
    await db
      .update(proposals)
      .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(proposals.id, row.id));
    await logActivity(null, "proposal.approved", "proposal", String(row.id), { via: "client" });
    const recipients = row.createdBy ? [row.createdBy] : [];
    for (const uid of recipients) {
      await notify(uid, {
        type: "proposal.approved",
        title: `Proposal approved — ${row.title}`,
        body: row.clientName ?? undefined,
        entity: "proposal",
        entityId: row.id,
        href: `/proposals/${row.id}`,
      });
    }
    await notifyRoles(["ops_manager", "admin"], {
      type: "proposal.approved",
      title: `Proposal approved — ${row.title}`,
      body: row.clientName ?? undefined,
      entity: "proposal",
      entityId: row.id,
      href: `/proposals/${row.id}`,
    }, row.createdBy ?? undefined);
    return Response.json({ ok: true, status: "approved" }, { status: 200, headers: CORS });
  }

  return Response.json({ error: "Unknown action" }, { status: 400, headers: CORS });
}
