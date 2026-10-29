// Financing-scenario calculator — the money model behind every estimate's
// payment options. Mirrors the Owest villa workbook exactly: down-payment ×
// tenor scenarios, reducing-balance or flat interest, admin fee, and the income
// needed to qualify. Admin-managed (site_settings key "estimate_finance");
// confirmed with the finance partner before any client sees a number.

export type InterestMethod = "reducing" | "flat";

export type FinanceInputs = {
  annualRate: number;        // e.g. 0.18
  method: InterestMethod;    // reducing balance (bank-style) | flat (on original)
  adminFeePct: number;       // of financed amount, paid upfront (0..1)
  debtBurdenRatio: number;   // max installment ÷ monthly income (e.g. 0.4)
  downOptions: number[];     // down-payment fractions, e.g. [0,.1,.2,.3,.4,.5]
  tenorOptions: number[];    // months, e.g. [48,54,60]
  selectedDownPct: number;   // default highlighted scenario
  selectedTenor: number;
};

export const FINANCE_DEFAULTS: FinanceInputs = {
  annualRate: 0.18,
  method: "reducing",
  adminFeePct: 0,
  debtBurdenRatio: 0.4,
  downOptions: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
  tenorOptions: [48, 54, 60],
  selectedDownPct: 0.2,
  selectedTenor: 60,
};

export function mergeFinance(over: Partial<FinanceInputs> | null | undefined): FinanceInputs {
  const base: FinanceInputs = JSON.parse(JSON.stringify(FINANCE_DEFAULTS));
  if (!over) return base;
  for (const k of Object.keys(over) as (keyof FinanceInputs)[]) {
    const v = over[k];
    if (v == null) continue;
    (base as Record<string, unknown>)[k] = v;
  }
  return base;
}

/** Monthly installment on a financed principal. Reducing = standard amortization
 *  on the outstanding balance; flat = interest on the original over the term. */
export function monthlyInstallment(principal: number, annualRate: number, months: number, method: InterestMethod): number {
  const n = Math.max(1, months);
  if (principal <= 0) return 0;
  if (method === "flat") return (principal * (1 + annualRate * (n / 12))) / n;
  const r = annualRate / 12;
  return r > 0 ? (principal * r) / (1 - Math.pow(1 + r, -n)) : principal / n;
}

export type Scenario = {
  downPct: number;
  downPayment: number;
  financed: number;
  tenor: number;
  monthly: number;
  adminFee: number;
  totalInterest: number;
  totalCost: number;     // down + all installments + admin fee
  costAboveCash: number; // fraction over the cash quotation
  minIncome: number;     // monthly ÷ debt-burden ratio
};

export function computeScenario(quotation: number, downPct: number, tenor: number, cfg: FinanceInputs): Scenario {
  const downPayment = quotation * downPct;
  const financed = quotation - downPayment;
  const monthly = monthlyInstallment(financed, cfg.annualRate, tenor, cfg.method);
  const adminFee = financed * cfg.adminFeePct;
  const totalInterest = monthly * tenor - financed;
  const totalCost = downPayment + monthly * tenor + adminFee;
  const costAboveCash = quotation > 0 ? totalCost / quotation - 1 : 0;
  const minIncome = cfg.debtBurdenRatio > 0 ? monthly / cfg.debtBurdenRatio : 0;
  return { downPct, downPayment, financed, tenor, monthly, adminFee, totalInterest, totalCost, costAboveCash, minIncome };
}

/** Every down-payment × tenor scenario, sorted by down payment then tenor. */
export function allScenarios(quotation: number, cfg: FinanceInputs): Scenario[] {
  const out: Scenario[] = [];
  for (const d of cfg.downOptions) for (const t of cfg.tenorOptions) out.push(computeScenario(quotation, d, t, cfg));
  return out;
}

export type AmortRow = { month: number; opening: number; installment: number; interest: number; principal: number; closing: number };

/** Month-by-month amortization for a financed principal over a tenor. */
export function amortization(financed: number, annualRate: number, tenor: number, method: InterestMethod): AmortRow[] {
  const n = Math.max(1, tenor);
  const installment = monthlyInstallment(financed, annualRate, n, method);
  const r = annualRate / 12;
  const flatInterest = method === "flat" ? (financed * annualRate) / 12 : 0;
  const rows: AmortRow[] = [];
  let opening = financed;
  for (let m = 1; m <= n; m++) {
    const interest = method === "flat" ? flatInterest : opening * r;
    const principal = installment - interest;
    const closing = Math.max(0, opening - principal);
    rows.push({ month: m, opening, installment, interest, principal, closing });
    opening = closing;
  }
  return rows;
}
