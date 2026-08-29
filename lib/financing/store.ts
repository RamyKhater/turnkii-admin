import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { mergeFinancing, type FinancingConfig } from "@/lib/financing";

export const FINANCING_KEY = "financing";

/** The published financing config, merged over defaults. Missing = defaults. */
export async function getFinancing(): Promise<{ config: FinancingConfig; published: boolean; updatedAt: Date | null }> {
  const db = await getDb();
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, FINANCING_KEY)).limit(1);
  const stored = (row?.value as Partial<FinancingConfig> | undefined) ?? null;
  return { config: mergeFinancing(stored), published: !!row && row.enabled, updatedAt: row?.updatedAt ?? null };
}
