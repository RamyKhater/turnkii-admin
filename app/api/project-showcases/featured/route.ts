import { and, eq, ne, desc, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { projectShowcases, projectShowcaseRatings } from "@/lib/db/schema";

// Public, no token: the images + supplier credits from every project showcase
// toggled "show on homepage", merged into one gallery grouped by service. Feeds
// the marketing homepage. CORS-open + cached so the static site can read it.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

type Item = {
  image: string;
  category?: string;
  caption?: string;
  note?: string;
  spec?: string;
  // stable identity so the homepage can post a rating for this exact image
  token: string;
  index: number;
  rating?: { avg: number; count: number };
};

export async function GET() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(projectShowcases)
    .where(and(eq(projectShowcases.featured, true), ne(projectShowcases.status, "archived")))
    .orderBy(desc(projectShowcases.updatedAt));

  // aggregate current ratings per (showcase, image) for all featured showcases
  const ids = rows.map((r) => r.id);
  const ratingBy = new Map<string, { avg: number; count: number }>();
  if (ids.length) {
    const agg = await db
      .select({
        showcaseId: projectShowcaseRatings.showcaseId,
        itemIndex: projectShowcaseRatings.itemIndex,
        avg: sql<number>`avg(${projectShowcaseRatings.value})::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(projectShowcaseRatings)
      .where(inArray(projectShowcaseRatings.showcaseId, ids))
      .groupBy(projectShowcaseRatings.showcaseId, projectShowcaseRatings.itemIndex);
    for (const a of agg) {
      ratingBy.set(`${a.showcaseId}:${a.itemIndex}`, { avg: Math.round(a.avg * 10) / 10, count: a.count });
    }
  }

  const items: Item[] = [];
  const credits: { image: string; service?: string; name?: string }[] = [];
  const seenCredit = new Set<string>();
  for (const r of rows) {
    (r.items ?? []).forEach((it, i) => {
      if (!it || !it.image) return;
      items.push({ ...it, token: r.token, index: i, rating: ratingBy.get(`${r.id}:${i}`) });
    });
    for (const c of r.credits ?? []) {
      if (!c || !c.image || !c.service) continue;
      const key = `${(c.service || "").toLowerCase()}|${c.image}`;
      if (seenCredit.has(key)) continue;
      seenCredit.add(key);
      credits.push(c);
    }
  }

  return Response.json(
    { items, credits },
    { status: 200, headers: { ...CORS, "Cache-Control": "public, max-age=300" } },
  );
}
