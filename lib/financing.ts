// Turnkii financing engine — the single source of truth for the instalment plans
// and pre-approval calculator on the marketing site. The admin publishes a config
// (stored in site_settings key "financing"); the marketing site reads it through
// /api/site-content and the intake route uses it to size pre-approvals. Shared by
// the /pricing editor (financing section) and the public site's calculators.

export type FinancingModel = "even" | "amortized" | "saver";

export type FinancingPlan = {
  key: string; // stable id (milestone | bank | rent | saver | …)
  name: string; // "Bank instalments"
  terms: string; // display label, e.g. "12–60 months"
  body: string; // description shown on the plan card
  fit: string; // audience chip, e.g. "Owners & end users"
  model: FinancingModel; // how the calculator computes a payment
  unit: "months" | "milestones"; // slider/label unit
  minTerm: number;
  maxTerm: number;
  defaultTerm: number;
  monthlyRate: number; // decimal per month, amortized model only (e.g. 0.0165)
  discountPct: number; // saver model only (e.g. 5)
  note: string; // calculator footnote; supports {cap} {amount} {discounted} tokens
  published: boolean; // show on the site
};

export type FinancingConfig = {
  currency: string;
  headline: string; // financing band heading on the homepage
  blurb: string; // financing band sub-copy
  plans: FinancingPlan[];
  preApproval: {
    incomeRatio: number; // share of monthly income an instalment may take (0.35)
    termMonths: number; // horizon used to size the indicative limit (48)
    maxLimit: number; // partner-bank ceiling in currency units (60_000_000)
    rounding: number; // round the limit down to this step (50_000)
  };
};

export const FINANCING_DEFAULTS: FinancingConfig = {
  currency: "EGP",
  headline: "Finish now, pay over 12 to 60 months.",
  blurb: "Milestone payments as standard, bank financing up to EGP 60M, rent-backed plans for portfolios, or save ahead at 5% off.",
  plans: [
    {
      key: "milestone", name: "Milestone", terms: "4 payments",
      body: "Deposit, mid-works, pre-delivery and handover. No interest, no third party.",
      fit: "Single unit", model: "even", unit: "milestones",
      minTerm: 4, maxTerm: 4, defaultTerm: 4, monthlyRate: 0, discountPct: 0,
      note: "Interest free: deposit, mid-works, pre-delivery and handover.", published: true,
    },
    {
      key: "bank", name: "Bank instalments", terms: "12–60 months",
      body: "Partner bank financing up to EGP 60M, approved alongside the survey.",
      fit: "Owners & end users", model: "amortized", unit: "months",
      minTerm: 12, maxTerm: 60, defaultTerm: 24, monthlyRate: 0.0165, discountPct: 0,
      note: "Illustrative bank rate, up to EGP {cap}, approved alongside the survey.", published: true,
    },
    {
      key: "rent", name: "Rent-backed", terms: "12–24 months",
      body: "Repayment scheduled against rental income once units are listed and let.",
      fit: "Investors, 3+ units", model: "even", unit: "months",
      minTerm: 12, maxTerm: 24, defaultTerm: 24, monthlyRate: 0, discountPct: 0,
      note: "Repaid from rental income once the units are listed and let.", published: true,
    },
    {
      key: "saver", name: "Plan ahead", terms: "10–12 months",
      body: "Save in equal interest-free instalments, then draw the full budget.",
      fit: "Interest free · 5% off", model: "saver", unit: "months",
      minTerm: 10, maxTerm: 12, defaultTerm: 12, monthlyRate: 0, discountPct: 5,
      note: "5% discount applied — you pay on EGP {discounted} and draw the budget at the end.", published: true,
    },
  ],
  preApproval: { incomeRatio: 0.35, termMonths: 48, maxLimit: 60_000_000, rounding: 50_000 },
};

/** Deep-merge a stored (possibly partial) override onto the defaults. Arrays
 *  (the plans list) replace wholesale when present, so a published edit fully
 *  defines the plan set the site shows. */
export function mergeFinancing(over: Partial<FinancingConfig> | null | undefined): FinancingConfig {
  const base: FinancingConfig = JSON.parse(JSON.stringify(FINANCING_DEFAULTS));
  if (!over) return base;
  for (const k of Object.keys(over) as (keyof FinancingConfig)[]) {
    const v = over[k];
    if (v == null) continue;
    if (k === "preApproval" && typeof v === "object") {
      base.preApproval = { ...base.preApproval, ...(v as object) };
    } else if (k === "plans" && Array.isArray(v)) {
      base.plans = (v as FinancingPlan[]).map((p) => ({ ...FINANCING_DEFAULTS.plans[0], ...p }));
    } else {
      (base as Record<string, unknown>)[k] = v;
    }
  }
  return base;
}

/** Indicative pre-approval limit for a monthly income, using the published
 *  affordability rule. Kept here so the site and the intake route agree. */
export function preApprovalLimit(monthlyIncome: number, cfg: FinancingConfig): number {
  const pa = cfg.preApproval;
  if (!(monthlyIncome > 0)) return 0;
  const raw = monthlyIncome * pa.incomeRatio * pa.termMonths;
  return Math.min(pa.maxLimit, Math.round(raw / pa.rounding) * pa.rounding);
}

/** The instalment (or per-milestone) payment for a plan, amount and term.
 *  Mirrors the marketing-site calculator so the admin sample matches the site. */
export function planPayment(plan: FinancingPlan, amount: number, term: number): number {
  const n = Math.max(1, term);
  if (plan.model === "amortized") {
    const r = plan.monthlyRate;
    return r > 0 ? (amount * r) / (1 - Math.pow(1 + r, -n)) : amount / n;
  }
  if (plan.model === "saver") return (amount * (1 - plan.discountPct / 100)) / n;
  return amount / n; // even split
}

/** Render a plan's footnote, filling {cap} {amount} {discounted} tokens. */
export function renderFinancingNote(plan: FinancingPlan, amount: number, cfg: FinancingConfig): string {
  const discounted = Math.round(amount * (1 - plan.discountPct / 100));
  return plan.note
    .replaceAll("{cap}", cfg.preApproval.maxLimit.toLocaleString("en-US"))
    .replaceAll("{amount}", Math.round(amount).toLocaleString("en-US"))
    .replaceAll("{discounted}", discounted.toLocaleString("en-US"));
}
