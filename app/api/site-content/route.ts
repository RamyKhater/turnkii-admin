import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contentBlocks, styles, services, products, inspirationShots, handovers, siteSettings } from "@/lib/db/schema";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  // The site build fetches this; a short cache is plenty and keeps rebuilds fresh.
  "Cache-Control": "public, max-age=30",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Public: the marketing site fetches this at build time (TURNKII_CONTENT_URL)
 * and bakes the published content into the static pages. Only published items
 * are exposed — drafts stay in the admin.
 */
export async function GET() {
  const db = await getDb();
  const [blocks, st, sv, pr, ins, ho, settings] = await Promise.all([
    db.select().from(contentBlocks),
    db.select().from(styles).where(eq(styles.published, true)).orderBy(asc(styles.sortOrder)),
    db.select().from(services).where(eq(services.published, true)).orderBy(asc(services.sortOrder)),
    db.select().from(products).where(eq(products.published, true)).orderBy(asc(products.sortOrder)),
    db
      .select()
      .from(inspirationShots)
      .where(eq(inspirationShots.published, true))
      .orderBy(asc(inspirationShots.sortOrder)),
    db.select().from(handovers).where(eq(handovers.published, true)).orderBy(asc(handovers.sortOrder)),
    db.select().from(siteSettings),
  ]);

  const block = (k: string) => blocks.find((b) => b.key === k)?.value ?? null;
  const published = block("__published") as { at?: string } | null;

  // Section visibility from the vertical feature flags (key = "vertical.<name>").
  const sections: Record<string, boolean> = {};
  for (const s of settings) {
    if (s.group === "vertical" && s.key.startsWith("vertical.")) {
      sections[s.key.slice("vertical.".length)] = s.enabled;
    }
  }

  // Published rate card (source of truth for the live estimate). Null = the site
  // falls back to pricing.js defaults.
  const pricingRow = settings.find((s) => s.key === "pricing" && s.enabled);
  // Published financing config (plans + pre-approval sizing). Null = site defaults.
  const financingRow = settings.find((s) => s.key === "financing" && s.enabled);

  const payload = {
    publishedAt: published?.at ?? null,
    sections,
    pricing: pricingRow?.value ?? null,
    financing: financingRow?.value ?? null,
    referralCredit: Number(settings.find((s) => s.key === "referral.creditEGP")?.value ?? 5000),
    hero: block("hero"),
    stats: block("stats") ?? [],
    styles: st.map((s) => ({
      key: s.key,
      name: s.name,
      blurb: s.blurb,
      fromPrice: s.fromPrice,
      leadTime: s.leadTime,
      pieceCount: s.pieceCount,
      image: s.heroImage,
      palette: s.palette ?? [],
      closeups: s.closeups ?? [],
    })),
    services: sv
      .filter((s) => s.enabled)
      .map((s) => ({
        key: s.key,
        name: s.name,
        short: s.short,
        description: s.description,
        lead: s.lead,
        priceFrom: s.priceFrom,
        image: s.image,
      })),
    marketplace: pr.map((p) => ({
      name: p.name,
      category: p.category,
      spec: p.spec,
      price: p.price,
      stock: p.stock,
      image: p.image,
    })),
    inspiration: ins.map((i) => ({
      style: i.key,
      room: i.room,
      title: i.title,
      spec: i.spec,
      image: i.image,
    })),
    handovers: ho.map((h) => ({
      key: h.key,
      location: h.location,
      title: h.title,
      provider: h.provider,
      role: h.role,
      brandMark: h.brandMark,
      brandHex: h.brandHex,
      shots: h.shots ?? [],
    })),
  };

  return Response.json(payload, { headers: CORS });
}
