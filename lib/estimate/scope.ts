// Scope & timeline template — splits a confirmed quotation into work packages,
// schedules them, and drives the escrow release + down-payment funding logic.
// A planning default for a villa finish-and-furnish (admin-managed, site_settings
// key "estimate_scope"); replaced by the real project BOQ when one exists.

export type ScopePackage = {
  name: string;
  scope: string;
  pct: number;          // share of contract (sums to 1 across packages)
  startWeek: number;
  durationWeeks: number;
};

export const WEEKS_PER_MONTH = 52 / 12;

export const SCOPE_DEFAULTS: ScopePackage[] = [
  { name: "Design, BOQ & approvals", scope: "Concept, 3D renders, BOQ, material selection, permits", pct: 0.03, startWeek: 0, durationWeeks: 3 },
  { name: "Site prep & civil works", scope: "Demolition, masonry, plastering, waterproofing", pct: 0.12, startWeek: 2, durationWeeks: 6 },
  { name: "MEP rough-in", scope: "Electrical, plumbing, drainage, HVAC ducting", pct: 0.15, startWeek: 4, durationWeeks: 8 },
  { name: "Flooring, tiling & marble", scope: "Floors, walls, stairs, skirting", pct: 0.14, startWeek: 9, durationWeeks: 7 },
  { name: "Ceilings, joinery & doors", scope: "Gypsum, wardrobes, internal doors, cladding", pct: 0.12, startWeek: 12, durationWeeks: 8 },
  { name: "Kitchen & bathrooms", scope: "Kitchen units, counters, sanitary ware, fittings", pct: 0.12, startWeek: 14, durationWeeks: 8 },
  { name: "Paint, finishes & lighting", scope: "Painting, decorative finishes, light fixtures", pct: 0.08, startWeek: 18, durationWeeks: 6 },
  { name: "HVAC units, smart home & shutters", scope: "AC units, automation, motorised shutters", pct: 0.08, startWeek: 16, durationWeeks: 8 },
  { name: "Furniture & FF&E", scope: "Loose furniture, curtains, rugs, accessories, styling", pct: 0.13, startWeek: 22, durationWeeks: 6 },
  { name: "Landscaping & outdoor", scope: "Garden, pergola, outdoor furniture, final handover", pct: 0.03, startWeek: 24, durationWeeks: 6 },
];

export function mergeScope(over: ScopePackage[] | null | undefined): ScopePackage[] {
  return Array.isArray(over) && over.length ? over : JSON.parse(JSON.stringify(SCOPE_DEFAULTS));
}

export type ScopeLine = ScopePackage & { index: number; value: number; endWeek: number; cumulative: number };

/** Value each package from the quotation, with end week and cumulative value. */
export function scopeLines(quotation: number, packages: ScopePackage[]): ScopeLine[] {
  let cumulative = 0;
  return packages.map((p, i) => {
    const value = quotation * p.pct;
    cumulative += value;
    return { ...p, index: i, value, endWeek: p.startWeek + p.durationWeeks, cumulative };
  });
}

export function totalWeeks(lines: ScopeLine[]): number {
  return lines.reduce((m, l) => Math.max(m, l.endWeek), 0);
}

/** Value of works executed per month (released from escrow on sign-off). Each
 *  package's value is spread evenly across its weeks, then integrated over
 *  calendar months of 52/12 weeks. */
export function monthlyExecuted(lines: ScopeLine[], months?: number): number[] {
  const n = months ?? Math.ceil(totalWeeks(lines) / WEEKS_PER_MONTH);
  const out = new Array(Math.max(1, n)).fill(0);
  for (const l of lines) {
    if (l.durationWeeks <= 0) continue;
    const rate = l.value / l.durationWeeks;
    const a = l.startWeek, b = l.startWeek + l.durationWeeks;
    for (let m = 1; m <= out.length; m++) {
      const w0 = (m - 1) * WEEKS_PER_MONTH, w1 = m * WEEKS_PER_MONTH;
      const overlap = Math.max(0, Math.min(b, w1) - Math.max(a, w0));
      out[m - 1] += overlap * rate;
    }
  }
  return out;
}

export type Funding = {
  perPackage: { index: number; name: string; value: number; down: number; financing: number }[];
  fundsLabel: string;     // what the down payment fully funds
  runsToWeek: number | null;
  financingLabel: string; // which packages financing funds
  financingAmount: number;
};

/** How a given down payment funds the programme: it covers packages in order
 *  until exhausted; financing funds the rest. */
export function fundingForDown(lines: ScopeLine[], downPayment: number): Funding {
  let remaining = downPayment;
  const perPackage = lines.map((l) => {
    const down = Math.max(0, Math.min(remaining, l.value));
    remaining -= down;
    return { index: l.index, name: l.name, value: l.value, down, financing: l.value - down };
  });

  const n = lines.length;
  if (downPayment <= 0) {
    return { perPackage, fundsLabel: "Nothing — all scope financed", runsToWeek: null,
      financingLabel: `Packages 1–${n}`, financingAmount: lines.reduce((s, l) => s + l.value, 0) };
  }

  let lastFull = -1, partialIdx = -1;
  perPackage.forEach((p, i) => {
    if (p.down > 0 && p.financing <= 1e-6) lastFull = i;
    else if (p.down > 0 && p.financing > 1e-6) partialIdx = i;
  });

  let fundsLabel: string;
  if (partialIdx >= 0) {
    const pctOfPartial = Math.round((perPackage[partialIdx].down / lines[partialIdx].value) * 100);
    fundsLabel = lastFull >= 0
      ? `Packages 1–${lastFull + 1} + ${pctOfPartial}% of package ${partialIdx + 1}`
      : `${pctOfPartial}% of package 1`;
  } else {
    fundsLabel = `Packages 1–${lastFull + 1}`;
  }

  const lastDownIdx = partialIdx >= 0 ? partialIdx : lastFull;
  const runsToWeek = lastDownIdx >= 0 ? lines[lastDownIdx].endWeek : null;
  const financingStart = perPackage.findIndex((p) => p.financing > 1e-6);
  const financingAmount = perPackage.reduce((s, p) => s + p.financing, 0);
  const financingLabel = financingStart >= 0 ? `Packages ${financingStart + 1}–${n}` : "None — fully covered by down payment";

  return { perPackage, fundsLabel, runsToWeek, financingLabel, financingAmount };
}
