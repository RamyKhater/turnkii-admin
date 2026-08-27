"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";
import { mergeRateCard, RATE_CARD_DEFAULTS, type RateCard, type EstimateInput } from "@/lib/pricing";
import { reviewRateCard, explainEstimate } from "@/lib/ai/pricing";
import { PRICING_KEY } from "./store";

export type PricingState = { error?: string; ok?: boolean };

/** Publish a rate card. The card is stored whole (merged over defaults) so the
 *  marketing estimate and every admin sample read exactly the same numbers. */
export async function publishRateCard(card: RateCard): Promise<PricingState> {
  const user = await assertCap("pricing:manage");
  const merged = mergeRateCard(card); // guard against partials from the client
  const db = await getDb();
  const now = new Date();
  await db
    .insert(siteSettings)
    .values({ key: PRICING_KEY, label: "Pricing rate card", group: "pricing", enabled: true, value: merged, updatedAt: now })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: merged, enabled: true, updatedAt: now } });
  await logActivity(user.id, "pricing.publish", "pricing");
  revalidatePath("/pricing");
  revalidatePath("/api/site-content");
  return { ok: true };
}

/** Reset to Turnkii defaults (disables the override; the site falls back). */
export async function resetRateCard(): Promise<PricingState> {
  const user = await assertCap("pricing:manage");
  const db = await getDb();
  await db.delete(siteSettings).where(eq(siteSettings.key, PRICING_KEY));
  await logActivity(user.id, "pricing.reset", "pricing");
  revalidatePath("/pricing");
  revalidatePath("/api/site-content");
  return { ok: true };
}

export async function defaultsCard(): Promise<RateCard> {
  return RATE_CARD_DEFAULTS;
}

/** AI guardrail: review a draft rate card for outliers before publishing. */
export async function aiReviewRateCard(card: RateCard): Promise<{ warnings: string[] }> {
  await assertCap("pricing:manage");
  return reviewRateCard(mergeRateCard(card), RATE_CARD_DEFAULTS);
}

/** AI: plain-language "why this estimate" for a sample unit. */
export async function aiExplainEstimate(input: EstimateInput, card: RateCard): Promise<{ text: string }> {
  await assertCap("pricing:manage");
  return { text: await explainEstimate(input, mergeRateCard(card)) };
}
