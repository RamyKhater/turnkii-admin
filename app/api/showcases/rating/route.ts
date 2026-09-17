import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { showcaseRatings } from "@/lib/db/schema";

// Public, no token: the overall client rating across all sample-work images,
// for the marketing homepage. CORS-open so the static site can read it.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  const db = await getDb();
  const [a] = await db
    .select({ avg: sql<number>`coalesce(avg(${showcaseRatings.value}),0)::float`, count: sql<number>`count(*)::int` })
    .from(showcaseRatings);
  return Response.json(
    { avg: a ? Math.round(a.avg * 10) / 10 : 0, count: a?.count ?? 0 },
    { status: 200, headers: { ...CORS, "Cache-Control": "public, max-age=300" } },
  );
}
