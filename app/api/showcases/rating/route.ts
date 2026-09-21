import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { showcaseRatings, projectShowcaseRatings } from "@/lib/db/schema";

// Public, no token: the overall client rating across BOTH sample-work images and
// the homepage project-showcase gallery, for the marketing homepage hero.
// CORS-open so the static site can read it.
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
  const [[s], [p]] = await Promise.all([
    db.select({ sum: sql<number>`coalesce(sum(${showcaseRatings.value}),0)::float`, count: sql<number>`count(*)::int` }).from(showcaseRatings),
    db.select({ sum: sql<number>`coalesce(sum(${projectShowcaseRatings.value}),0)::float`, count: sql<number>`count(*)::int` }).from(projectShowcaseRatings),
  ]);
  const sum = (s?.sum ?? 0) + (p?.sum ?? 0);
  const count = (s?.count ?? 0) + (p?.count ?? 0);
  const avg = count ? Math.round((sum / count) * 10) / 10 : 0;
  return Response.json(
    { avg, count },
    { status: 200, headers: { ...CORS, "Cache-Control": "public, max-age=300" } },
  );
}
