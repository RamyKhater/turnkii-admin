import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { mergeRates, type EstimateRateCard } from "@/lib/estimate/rates";
import { mergeFinance, type FinanceInputs } from "@/lib/estimate/finance";
import { mergeScope, type ScopePackage } from "@/lib/estimate/scope";

export const RATES_KEY = "estimate_rates";
export const FINANCE_KEY = "estimate_finance";
export const SCOPE_KEY = "estimate_scope";

/** The three admin-managed estimate configs, each merged over its defaults.
 *  Missing settings fall back to the seeded defaults. One query for all three. */
export async function getEstimateConfig(): Promise<{ rates: EstimateRateCard; finance: FinanceInputs; scope: ScopePackage[] }> {
  const db = await getDb();
  const rows = await db.select().from(siteSettings).where(inArray(siteSettings.key, [RATES_KEY, FINANCE_KEY, SCOPE_KEY]));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    rates: mergeRates((byKey.get(RATES_KEY) as Partial<EstimateRateCard>) ?? null),
    finance: mergeFinance((byKey.get(FINANCE_KEY) as Partial<FinanceInputs>) ?? null),
    scope: mergeScope((byKey.get(SCOPE_KEY) as ScopePackage[]) ?? null),
  };
}

export async function getEstimateFinance(): Promise<FinanceInputs> {
  const db = await getDb();
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, FINANCE_KEY)).limit(1);
  return mergeFinance((row?.value as Partial<FinanceInputs>) ?? null);
}
