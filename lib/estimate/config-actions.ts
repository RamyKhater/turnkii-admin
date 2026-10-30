"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";
import { mergeFinance, type FinanceInputs } from "@/lib/estimate/finance";
import { mergeScope, type ScopePackage } from "@/lib/estimate/scope";
import { mergeRates, type EstimateRateCard } from "@/lib/estimate/rates";
import { RATES_KEY, FINANCE_KEY, SCOPE_KEY } from "@/lib/estimate/store";

export type CfgState = { error?: string; ok?: boolean };

async function upsert(key: string, label: string, value: unknown) {
  const db = await getDb();
  const now = new Date();
  await db.insert(siteSettings)
    .values({ key, label, group: "estimates", enabled: true, value, updatedAt: now })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, enabled: true, updatedAt: now } });
}

const num = (v: FormDataEntryValue | null, d = 0) => { const n = Number(String(v ?? "").trim()); return Number.isFinite(n) ? n : d; };
const nums = (v: FormDataEntryValue | null) => String(v ?? "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));

/** Save the finance inputs (rates, method, options, debt-burden). */
export async function saveEstimateFinance(_prev: CfgState, form: FormData): Promise<CfgState> {
  const user = await assertCap("settings:manage");
  const method = String(form.get("method") || "reducing");
  const cfg: FinanceInputs = mergeFinance({
    annualRate: num(form.get("annualRate")) / 100,       // entered as a %
    method: method === "flat" ? "flat" : "reducing",
    adminFeePct: num(form.get("adminFeePct")) / 100,
    debtBurdenRatio: num(form.get("debtBurdenRatio")) / 100,
    downOptions: nums(form.get("downOptions")).map((p) => p / 100),
    tenorOptions: nums(form.get("tenorOptions")).map((t) => Math.round(t)),
    selectedDownPct: num(form.get("selectedDownPct")) / 100,
    selectedTenor: Math.round(num(form.get("selectedTenor"), 60)),
  });
  if (!cfg.downOptions.length || !cfg.tenorOptions.length) return { error: "Add at least one down-payment option and one tenor." };
  await upsert(FINANCE_KEY, "Estimate — finance inputs", cfg);
  await logActivity(user.id, "estimate.finance.save", "settings");
  revalidatePath("/estimates/settings");
  return { ok: true };
}

/** Save the scope & timeline template (rows of % / start / duration). */
export async function saveEstimateScope(_prev: CfgState, form: FormData): Promise<CfgState> {
  const user = await assertCap("settings:manage");
  let rows: ScopePackage[];
  try { rows = JSON.parse(String(form.get("rows") || "[]")); } catch { return { error: "Could not read the rows." }; }
  rows = mergeScope(rows.map((r) => ({
    name: String(r.name || "").trim(), scope: String(r.scope || "").trim(),
    pct: Number(r.pct) || 0, startWeek: Math.round(Number(r.startWeek) || 0), durationWeeks: Math.round(Number(r.durationWeeks) || 0),
  })).filter((r) => r.name));
  const sum = rows.reduce((s, r) => s + r.pct, 0);
  if (Math.abs(sum - 1) > 0.005) return { error: `Shares must add up to 100% (currently ${(sum * 100).toFixed(1)}%).` };
  await upsert(SCOPE_KEY, "Estimate — scope & timeline", rows);
  await logActivity(user.id, "estimate.scope.save", "settings");
  revalidatePath("/estimates/settings");
  return { ok: true };
}

/** Save the cost rate card (JSON, validated through mergeRates). */
export async function saveEstimateRates(_prev: CfgState, form: FormData): Promise<CfgState> {
  const user = await assertCap("settings:manage");
  let parsed: Partial<EstimateRateCard>;
  try { parsed = JSON.parse(String(form.get("json") || "{}")); } catch { return { error: "Invalid JSON." }; }
  const merged = mergeRates(parsed);
  if (!merged.packages.length) return { error: "Keep at least one package." };
  await upsert(RATES_KEY, "Estimate — rate card", merged);
  await logActivity(user.id, "estimate.rates.save", "settings");
  revalidatePath("/estimates/settings");
  return { ok: true };
}

export async function resetEstimateConfig(which: "finance" | "scope" | "rates"): Promise<CfgState> {
  const user = await assertCap("settings:manage");
  const db = await getDb();
  const key = which === "finance" ? FINANCE_KEY : which === "scope" ? SCOPE_KEY : RATES_KEY;
  await db.delete(siteSettings).where(eq(siteSettings.key, key));
  await logActivity(user.id, "estimate.config.reset", "settings", undefined, { which });
  revalidatePath("/estimates/settings");
  return { ok: true };
}
