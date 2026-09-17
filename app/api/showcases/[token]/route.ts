import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { showcases, showcaseRatings } from "@/lib/db/schema";

// Public, token-gated: the marketing site's hidden /w page fetches this by the
// unguessable token. CORS-open so the static site (a different origin) can read it.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 24 || token.length > 80) {
    return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
  }
  const db = await getDb();
  const [row] = await db.select().from(showcases).where(eq(showcases.token, token)).limit(1);
  if (!row || row.status === "archived") {
    return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
  }

  if (!row.viewedAt) {
    await db
      .update(showcases)
      .set({ viewedAt: new Date(), status: row.status === "shared" ? "viewed" : row.status })
      .where(eq(showcases.id, row.id));
  }

  // Per-image rating aggregates (avg + count), keyed by item index.
  const agg = await db
    .select({ idx: showcaseRatings.itemIndex, avg: sql<number>`avg(${showcaseRatings.value})::float`, count: sql<number>`count(*)::int` })
    .from(showcaseRatings)
    .where(eq(showcaseRatings.showcaseId, row.id))
    .groupBy(showcaseRatings.itemIndex);
  const byIdx = new Map(agg.map((a) => [a.idx, { avg: Math.round(a.avg * 10) / 10, count: a.count }]));

  const items = (row.items ?? [])
    .filter((i) => i && i.image)
    .map((i, idx) => ({ ...i, rating: byIdx.get(idx) ?? { avg: 0, count: 0 } }));

  return Response.json(
    {
      title: row.title,
      subtitle: row.subtitle,
      intro: row.intro,
      items,
      cta: { label: row.ctaLabel, href: row.ctaHref },
    },
    { status: 200, headers: CORS },
  );
}
