import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { projectShowcases } from "@/lib/db/schema";

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
  const [row] = await db.select().from(projectShowcases).where(eq(projectShowcases.token, token)).limit(1);
  if (!row || row.status === "archived") {
    return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
  }

  if (!row.viewedAt) {
    await db
      .update(projectShowcases)
      .set({ viewedAt: new Date(), status: row.status === "shared" ? "viewed" : row.status })
      .where(eq(projectShowcases.id, row.id));
  }

  return Response.json(
    {
      title: row.title,
      subtitle: row.subtitle,
      intro: row.intro,
      items: (row.items ?? []).filter((i) => i && i.image),
      credits: (row.credits ?? []).filter((c) => c && c.image && c.service),
      cta: { label: row.ctaLabel, href: row.ctaHref },
    },
    { status: 200, headers: CORS },
  );
}
