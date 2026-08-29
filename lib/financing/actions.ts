"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";
import { mergeFinancing, FINANCING_DEFAULTS, type FinancingConfig } from "@/lib/financing";
import { FINANCING_KEY } from "./store";

export type FinancingState = { error?: string; ok?: boolean };

/** Publish the financing config. Stored whole (merged over defaults) so the
 *  site calculators and the pre-approval intake read exactly the same numbers. */
export async function publishFinancing(config: FinancingConfig): Promise<FinancingState> {
  const user = await assertCap("pricing:manage");
  const merged = mergeFinancing(config); // guard against partials from the client
  if (!merged.plans.some((p) => p.published)) {
    return { error: "Keep at least one plan published." };
  }
  const db = await getDb();
  const now = new Date();
  await db
    .insert(siteSettings)
    .values({ key: FINANCING_KEY, label: "Financing & plans", group: "pricing", enabled: true, value: merged, updatedAt: now })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: merged, enabled: true, updatedAt: now } });
  await logActivity(user.id, "financing.publish", "pricing");
  revalidatePath("/pricing");
  revalidatePath("/api/site-content");
  return { ok: true };
}

/** Reset to Turnkii defaults (removes the override; the site falls back). */
export async function resetFinancing(): Promise<FinancingState> {
  const user = await assertCap("pricing:manage");
  const db = await getDb();
  await db.delete(siteSettings).where(eq(siteSettings.key, FINANCING_KEY));
  await logActivity(user.id, "financing.reset", "pricing");
  revalidatePath("/pricing");
  revalidatePath("/api/site-content");
  return { ok: true };
}

export async function defaultsFinancing(): Promise<FinancingConfig> {
  return FINANCING_DEFAULTS;
}
