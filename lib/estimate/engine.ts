import { type EstimateRateCard, type EstimateTier } from "@/lib/estimate/rates";
import { type FinanceInputs, type Scenario, type AmortRow, allScenarios, computeScenario, amortization } from "@/lib/estimate/finance";
import { type ScopePackage, type ScopeLine, scopeLines, monthlyExecuted, totalWeeks, fundingForDown, type Funding, WEEKS_PER_MONTH } from "@/lib/estimate/scope";
import { escrowCashPlan, installmentSplit, type CashRow } from "@/lib/estimate/payment-plan";

// ─── Auto-cost: brief + property data + rate card → a provisional quotation ───
export type EstimateBrief = {
  propertyType?: string | null;
  area?: number | null;
  units?: number | null;
  services?: string[] | null;
  style?: string | null;
  package?: string | null;
  budgetPlan?: string | null;
  materials?: string[] | null;
};

export type CostLine = { key: string; label: string; basis: string; qty: number; unit: string; rate: number; amount: number };
export type AutoCost = { quotation: number; tier: EstimateTier; area: number; units: number; lines: CostLine[]; assumptions: string[] };

export function autoCost(brief: EstimateBrief, card: EstimateRateCard): AutoCost {
  const choice = (brief.package || brief.budgetPlan || "").trim();
  const tier: EstimateTier = card.tierByChoice[choice] ?? card.defaultTier;
  const area = Number(brief.area) > 0 ? Number(brief.area)
    : (card.defaultAreaByType[brief.propertyType ?? ""] ?? card.defaultAreaByType.default ?? 150);
  const units = Number(brief.units) > 0 ? Number(brief.units) : 1;
  const services = (brief.services ?? []).map((s) => String(s).toLowerCase().trim());

  const matches = (pkg: EstimatePkgLike) => pkg.appliesWhenService.length === 0
    || pkg.appliesWhenService.some((s) => services.includes(s.toLowerCase()));
  const enabled = card.packages.filter((p) => p.enabled);
  let selected = enabled.filter(matches);
  // Always cost a base if the brief named no matching service.
  if (selected.every((p) => p.basis === "pct_subtotal")) {
    const finishing = enabled.find((p) => p.key === "finishing");
    if (finishing && !selected.includes(finishing)) selected = [finishing, ...selected];
  }

  const assumptions: string[] = [];
  if (!(Number(brief.area) > 0)) assumptions.push(`Area assumed ${area} m² for a ${brief.propertyType ?? "property"}`);
  assumptions.push(`${tier} tier`);

  const direct: CostLine[] = [];
  for (const p of selected) {
    if (p.basis === "pct_subtotal") continue;
    const rate = p.rates[tier] ?? 0;
    const qty = p.basis === "per_m2" ? area : p.basis === "per_unit" ? units : 1;
    direct.push({ key: p.key, label: p.label, basis: p.basis, qty, unit: p.unit, rate, amount: qty * rate });
  }
  const subtotal = direct.reduce((s, l) => s + l.amount, 0);
  const pctLines: CostLine[] = selected.filter((p) => p.basis === "pct_subtotal").map((p) => {
    const rate = p.rates[tier] ?? 0;
    return { key: p.key, label: p.label, basis: p.basis, qty: 1, unit: p.unit, rate, amount: subtotal * rate };
  });
  const quotation = Math.round(subtotal + pctLines.reduce((s, l) => s + l.amount, 0));
  return { quotation, tier, area, units, lines: [...direct, ...pctLines], assumptions };
}
type EstimatePkgLike = EstimateRateCard["packages"][number];

// ─── Assemble the full estimate output from a (confirmed or provisional) quote ─
export type EstimateOutput = {
  quotation: number;
  scope: ScopeLine[];
  totalWeeks: number;
  worksDurationMonths: number;
  monthlyExecuted: number[];
  scenarios: Scenario[];
  selected: Scenario;
  amortization: AmortRow[];
  cashPlan: CashRow[];
  installments: { duringWorks: number; afterHandover: number };
  fundingByDown: ({ downPct: number; downPayment: number } & Funding)[];
};

export function assembleEstimate(quotation: number, finance: FinanceInputs, packages: ScopePackage[]): EstimateOutput {
  const scope = scopeLines(quotation, packages);
  const executed = monthlyExecuted(scope);
  const worksDurationMonths = executed.filter((v) => v > 1e-6).length;
  const scenarios = allScenarios(quotation, finance);
  const selected = computeScenario(quotation, finance.selectedDownPct, finance.selectedTenor, finance);
  const amort = amortization(selected.financed, finance.annualRate, selected.tenor, finance.method);
  const cashPlan = escrowCashPlan(selected, executed, quotation);
  const fundingByDown = finance.downOptions.map((d) => ({ downPct: d, downPayment: quotation * d, ...fundingForDown(scope, quotation * d) }));
  return {
    quotation, scope, totalWeeks: totalWeeks(scope), worksDurationMonths, monthlyExecuted: executed,
    scenarios, selected, amortization: amort, cashPlan, installments: installmentSplit(selected, executed), fundingByDown,
  };
}

export { WEEKS_PER_MONTH };
