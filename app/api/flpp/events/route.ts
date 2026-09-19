import { getDb } from "@/lib/db";
import { activityLog } from "@/lib/db/schema";

// Receives flpp → Turnkii write-backs (scope.locked, project.progress,
// po.shortfall, …). Token-authenticated. Logged to the activity feed so the
// Turnkii side has an audit trail of what the execution layer reported back.
function authed(req: Request): boolean {
  const token = process.env.FLPP_API_TOKEN || "dev-shared-token";
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export async function POST(req: Request) {
  if (!authed(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { name?: string; ticketRef?: string; payload?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.name) return Response.json({ error: "name required" }, { status: 400 });

  const db = await getDb();
  await db.insert(activityLog).values({
    userId: null,
    action: `flpp:${body.name}`,
    entity: "flpp_event",
    entityId: body.ticketRef ?? null,
    meta: body.payload ?? {},
  });

  return Response.json({ ok: true });
}
