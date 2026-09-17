import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { showcases, showcaseRatings } from "@/lib/db/schema";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rl = await rateLimit(`rate:${clientIp(req.headers)}`, 40, 60_000);
  if (!rl.ok) return Response.json({ error: "Too many ratings" }, { status: 429, headers: CORS });
  if (!token || token.length < 24 || token.length > 80) {
    return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
  }

  let body: { index?: number; value?: number; voter?: string } = {};
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS }); }
  const index = Number(body.index);
  const value = Number(body.value);
  const voter = String(body.voter ?? "").trim().slice(0, 64);
  if (!Number.isInteger(index) || index < 0 || !Number.isInteger(value) || value < 1 || value > 5 || voter.length < 6) {
    return Response.json({ error: "Invalid rating" }, { status: 422, headers: CORS });
  }

  const db = await getDb();
  const [row] = await db.select().from(showcases).where(eq(showcases.token, token)).limit(1);
  if (!row || row.status === "archived") return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
  const itemCount = (row.items ?? []).filter((i) => i && i.image).length;
  if (index >= itemCount) return Response.json({ error: "Invalid image" }, { status: 422, headers: CORS });

  await db
    .insert(showcaseRatings)
    .values({ showcaseId: row.id, itemIndex: index, value, voter })
    .onConflictDoUpdate({
      target: [showcaseRatings.showcaseId, showcaseRatings.itemIndex, showcaseRatings.voter],
      set: { value, updatedAt: new Date() },
    });

  const [a] = await db
    .select({ avg: sql<number>`avg(${showcaseRatings.value})::float`, count: sql<number>`count(*)::int` })
    .from(showcaseRatings)
    .where(and(eq(showcaseRatings.showcaseId, row.id), eq(showcaseRatings.itemIndex, index)));

  return Response.json(
    { ok: true, rating: { avg: a ? Math.round(a.avg * 10) / 10 : value, count: a?.count ?? 1 } },
    { status: 200, headers: CORS },
  );
}
