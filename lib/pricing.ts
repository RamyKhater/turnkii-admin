// Turnkii pricing engine — the single source of truth for every live estimate.
// The admin publishes a rate card (stored in site_settings key "pricing"); the
// marketing site reads the published card through /api/site-content. This module
// is shared by the /pricing editor (live sample) and the intake/estimate paths.

export type RateCard = {
  currency: string;
  minJob: number;
  apr: number;
  downPct: number;
  saverDiscount: number;
  spreadFloor: number;
  spreadCeiling: number;
  multiUnitDiscount: number;
  styleRate: Record<string, number>;
  packageFactor: Record<string, number>;
  serviceRate: Record<string, number>;
  propertyFactor: Record<string, number>;
  serviceWeeks: Record<string, number>;
  care: {
    cleaningPerM2: number; cleaningMin: number; maintenanceCallout: number; planDiscount: number;
    cleaningBase: number; cleaningPerRoom: number;
    cleaningScopes: Record<string, number>;
    maintenanceRates: Record<string, number>;
  };
  baseWeeks: number;
};

export const RATE_CARD_DEFAULTS: RateCard = {
  currency: "EGP",
  minJob: 280000,
  apr: 18.5,
  downPct: 20,
  saverDiscount: 5,
  spreadFloor: 5,
  spreadCeiling: 16,
  multiUnitDiscount: 8,
  styleRate: { warm: 7400, neoclassic: 9600, majlis: 8900, eclectic: 8100, coastal: 6900 },
  packageFactor: { none: 0, essential: 0.24, signature: 0.42, bespoke: 0.62 },
  serviceRate: { kitchen: 1150, hvac: 640, shutters: 310, outdoor: 390 },
  propertyFactor: {
    Apartment: 1, "Villa / townhouse": 1.08, "Multiple units": 0.94,
    "Short-stay rental": 0.96, "Commercial / hospitality": 1.12,
  },
  serviceWeeks: { finishing: 6, furnishing: 3, ffe: 4, kitchen: 3, hvac: 2, shutters: 1, outdoor: 2 },
  care: {
    cleaningPerM2: 55, cleaningMin: 1800, maintenanceCallout: 750, planDiscount: 12,
    cleaningBase: 600, cleaningPerRoom: 450,
    cleaningScopes: { "Whole unit": 1, "Kitchen & bathrooms": 0.7, "Post-works clean": 1.35, "Windows & terrace": 0.55 },
    maintenanceRates: { "AC service": 900, "Plumbing": 750, "Electrics": 800, "Joinery": 950, "Snag fix": 700, "Not sure yet": 750 },
  },
  baseWeeks: 3,
};

/** Deep-merge a stored (possibly partial) override onto the defaults. */
export function mergeRateCard(over: Partial<RateCard> | null | undefined): RateCard {
  const base: RateCard = JSON.parse(JSON.stringify(RATE_CARD_DEFAULTS));
  if (!over) return base;
  for (const k of Object.keys(over) as (keyof RateCard)[]) {
    const v = over[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      (base as Record<string, unknown>)[k] = { ...(base[k] as object), ...(v as object) };
    } else if (v != null) {
      (base as Record<string, unknown>)[k] = v;
    }
  }
  return base;
}

export type EstimateInput = {
  services?: string[];
  area?: number;
  units?: number;
  style?: string;
  pkg?: string;
  ptype?: string;
  months?: number;
  answered?: number;
  answerTotal?: number;
};

export type Estimate = {
  ready: boolean;
  lines: { label: string; rate: number }[];
  rate: number; perUnit: number; total: number; units: number;
  lo: number; hi: number; spreadPct: number; confidence: number; weeks: number;
  monthly: number; down: number; saver: number;
};

const SERVICE_LABEL: Record<string, string> = {
  kitchen: "Kitchen", hvac: "HVAC", shutters: "Shutters & blinds", outdoor: "Outdoor",
};

export function estimate(input: EstimateInput, card: RateCard = RATE_CARD_DEFAULTS): Estimate {
  const i = input || {};
  const area = Number(i.area) > 0 ? Number(i.area) : 0;
  const units = Math.max(1, Number(i.units) || 1);
  const services = i.services && i.services.length ? i.services : [];
  const has = (id: string) => services.indexOf(id) !== -1;

  const styleRate = card.styleRate[i.style ?? ""] ?? card.styleRate.warm;
  const ptypeFactor = card.propertyFactor[i.ptype ?? ""] ?? 1;
  const pkgFactor = i.pkg && i.pkg in card.packageFactor ? card.packageFactor[i.pkg] : card.packageFactor.signature;

  let rate = 0;
  let weeks = card.baseWeeks;
  let lines: { label: string; rate: number }[] = [];
  const line = (label: string, r: number) => { if (r > 0) { rate += r; lines.push({ label, rate: r }); } };

  if (has("finishing")) { line("Finishing", styleRate * ptypeFactor); weeks += card.serviceWeeks.finishing; }
  if (has("furnishing") || has("ffe")) {
    line("Furniture package", styleRate * pkgFactor);
    weeks += has("ffe") ? card.serviceWeeks.ffe : card.serviceWeeks.furnishing;
  }
  (["kitchen", "hvac", "shutters", "outdoor"] as const).forEach((k) => {
    if (has(k)) { line(SERVICE_LABEL[k], card.serviceRate[k]); weeks += card.serviceWeeks[k]; }
  });
  if (!services.length) { rate = styleRate * 0.35; lines = [{ label: "Scope to be surveyed", rate }]; }

  let perUnit = Math.max(card.minJob, rate * (area || 0));
  if (!area) perUnit = 0;
  let total = perUnit * units;
  if (units >= 5) total = total * (1 - card.multiUnitDiscount / 100);

  const answered = Number(i.answered) || 0;
  const answerTotal = Math.max(1, Number(i.answerTotal) || 8);
  const confidence = Math.round(40 + (answered / answerTotal) * 54);
  const spread = (card.spreadCeiling - (confidence / 100) * (card.spreadCeiling - card.spreadFloor)) / 100;

  const months = Math.max(6, Number(i.months) || 36);
  const r = card.apr / 100 / 12;
  const financed = total * (1 - card.downPct / 100);
  const monthly = r > 0 ? (financed * r) / (1 - Math.pow(1 + r, -months)) : financed / months;

  return {
    ready: total > 0, lines,
    rate, perUnit, total, units,
    lo: total * (1 - spread), hi: total * (1 + spread),
    spreadPct: Math.round(spread * 1000) / 10,
    confidence,
    weeks: Math.round(weeks * (0.75 + Math.min(1, (area || 150) / 400) * 0.45)),
    monthly, down: (total * card.downPct) / 100, saver: total * (1 - card.saverDiscount / 100),
  };
}

export type CareInput = { service: "cleaning" | "maintenance"; area?: number; plan?: "once" | "plan" };
export function careQuote(input: CareInput, card: RateCard = RATE_CARD_DEFAULTS) {
  const c = card.care;
  const i = input || ({} as CareInput);
  const area = Number(i.area) > 0 ? Number(i.area) : 0;
  const perVisit = i.service === "maintenance" ? c.maintenanceCallout : Math.max(c.cleaningMin, area * c.cleaningPerM2);
  const visits = i.service === "maintenance" ? 4 : 3;
  const annual = perVisit * visits * (1 - c.planDiscount / 100);
  return {
    ready: i.service === "maintenance" ? true : area > 0,
    perVisit, visits, annual, planDiscount: c.planDiscount,
    due: i.plan === "plan" ? annual : perVisit,
  };
}

export function money(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return "EGP " + (n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2) + "M";
  return "EGP " + Math.round(n / 1000) + "k";
}
export function full(n: number): string {
  return "EGP " + Math.round(n || 0).toLocaleString("en-US");
}
export function range(lo: number, hi: number): string {
  if (!lo || !hi) return "—";
  return money(lo) + " – " + money(hi).replace(/^EGP\s*/, "");
}
