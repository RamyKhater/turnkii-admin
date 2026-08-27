import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { mergeRateCard, type RateCard } from "@/lib/pricing";

export const PRICING_KEY = "pricing";

/** The published rate card, merged over defaults. Missing = running defaults. */
export async function getRateCard(): Promise<{ card: RateCard; published: boolean; updatedAt: Date | null }> {
  const db = await getDb();
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, PRICING_KEY)).limit(1);
  const stored = (row?.value as Partial<RateCard> | undefined) ?? null;
  return { card: mergeRateCard(stored), published: !!row && row.enabled, updatedAt: row?.updatedAt ?? null };
}
