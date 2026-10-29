// Estimate rate card — the default EGP rates used to auto-cost a brief before a
// real FLPP pricing sheet exists. Admin-managed (stored in site_settings key
// "estimate_rates"; edited from the admin, per the admin-managed rule) and
// seeded with sensible Egypt fit-out estimates that can be refreshed from the
// FLPP catalog. Internal only — the customer never sees an auto number; it seeds
// the FLPP estimator and sanity-checks the confirmed figure.

export type RateBasis = "per_m2" | "per_unit" | "pct_subtotal" | "lump";
export type EstimateTier = "essential" | "standard" | "premium" | "signature";
export const TIERS: EstimateTier[] = ["essential", "standard", "premium", "signature"];
export const TIER_LABEL: Record<EstimateTier, string> = {
  essential: "Essential", standard: "Standard", premium: "Premium", signature: "Signature",
};

export type EstimatePackageRate = {
  key: string;        // finishing | furniture | appliance | ffe | kitchen | service | other
  label: string;
  basis: RateBasis;
  unit: string;       // display unit (m², unit, project, …)
  enabled: boolean;
  rates: Record<EstimateTier, number>; // per_m2: EGP/m² · per_unit: EGP/dwelling · pct_subtotal: 0..1 · lump: EGP
  /** Brief service keys that pull this package in. Empty = always considered. */
  appliesWhenService: string[];
};

export type EstimateRateCard = {
  currency: string;
  contingencyPct: number;              // ± band on the subtotal for the internal range (0..1)
  defaultTier: EstimateTier;
  defaultAreaByType: Record<string, number>; // assumed m² when the brief omits area
  tierByChoice: Record<string, EstimateTier>; // map a brief package / budget label → tier
  packages: EstimatePackageRate[];
};

// Egypt fit-out ballpark (EGP), editable in admin. Per-m² rates are of unit area;
// per_unit is per dwelling; pct_subtotal is a fraction of the other lines.
export const ESTIMATE_RATES_DEFAULTS: EstimateRateCard = {
  currency: "EGP",
  contingencyPct: 0.15,
  defaultTier: "standard",
  defaultAreaByType: { Apartment: 140, Villa: 320, Duplex: 240, Chalet: 110, Studio: 70, Office: 160, Retail: 120, default: 150 },
  tierByChoice: {
    "Under 750K": "essential", "750K – 1.5M": "standard", "1.5M – 3M": "premium", "3M – 6M": "signature", "6M +": "signature",
    essential: "essential", standard: "standard", premium: "premium", signature: "signature",
  },
  packages: [
    { key: "finishing", label: "Finishing & renovation", basis: "per_m2", unit: "m²", enabled: true, appliesWhenService: ["finishing", "renovation"],
      rates: { essential: 3500, standard: 5500, premium: 8500, signature: 13000 } },
    { key: "kitchen", label: "Kitchen", basis: "per_unit", unit: "home", enabled: true, appliesWhenService: ["kitchen", "kitchens"],
      rates: { essential: 90000, standard: 180000, premium: 340000, signature: 600000 } },
    { key: "furniture", label: "Furniture", basis: "per_m2", unit: "m²", enabled: true, appliesWhenService: ["furniture", "furnishing"],
      rates: { essential: 2000, standard: 3500, premium: 6000, signature: 10000 } },
    { key: "appliance", label: "Appliances", basis: "per_unit", unit: "home", enabled: true, appliesWhenService: ["appliance", "appliances"],
      rates: { essential: 60000, standard: 120000, premium: 220000, signature: 400000 } },
    { key: "ffe", label: "FF&E", basis: "per_m2", unit: "m²", enabled: true, appliesWhenService: ["ffe", "ff&e"],
      rates: { essential: 1000, standard: 1800, premium: 3000, signature: 5000 } },
    { key: "hvac", label: "HVAC & MEP", basis: "per_m2", unit: "m²", enabled: true, appliesWhenService: ["hvac", "mep", "ac"],
      rates: { essential: 700, standard: 1100, premium: 1700, signature: 2600 } },
    { key: "management", label: "Project management & QA", basis: "pct_subtotal", unit: "project", enabled: true, appliesWhenService: [],
      rates: { essential: 0.06, standard: 0.08, premium: 0.10, signature: 0.12 } },
  ],
};

/** Deep-merge a stored (possibly partial) override onto the defaults; the
 *  packages array replaces wholesale when present, like the financing config. */
export function mergeRates(over: Partial<EstimateRateCard> | null | undefined): EstimateRateCard {
  const base: EstimateRateCard = JSON.parse(JSON.stringify(ESTIMATE_RATES_DEFAULTS));
  if (!over) return base;
  for (const k of Object.keys(over) as (keyof EstimateRateCard)[]) {
    const v = over[k];
    if (v == null) continue;
    if (k === "packages" && Array.isArray(v)) base.packages = v as EstimatePackageRate[];
    else if ((k === "defaultAreaByType" || k === "tierByChoice") && typeof v === "object") {
      (base as Record<string, unknown>)[k] = { ...(base[k] as object), ...(v as object) };
    } else (base as Record<string, unknown>)[k] = v;
  }
  return base;
}
