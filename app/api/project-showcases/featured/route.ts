import { and, eq, ne, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { projectShowcases } from "@/lib/db/schema";

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

export async function GET() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(projectShowcases)
    .where(and(eq(projectShowcases.featured, true), ne(projectShowcases.status, "archived")))
    .orderBy(desc(projectShowcases.updatedAt));

  const items: { image: string; category?: string; caption?: string; note?: string; spec?: string }[] = [];
  const credits: { image: string; service?: string; name?: string }[] = [];
  const seenCredit = new Set<string>();
  for (const r of rows) {
    for (const it of r.items ?? []) if (it && it.image) items.push(it);
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
