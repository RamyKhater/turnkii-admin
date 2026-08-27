import "server-only";
import { ai, AI_MODEL, aiEnabled, parseJson, textOf } from "./client";
import { estimate, full, range, type RateCard, type EstimateInput } from "@/lib/pricing";

/** Guardrail: flag outliers / inconsistencies in a rate-card draft before publish. */
export async function reviewRateCard(draft: RateCard, baseline: RateCard): Promise<{ warnings: string[] }> {
  if (!aiEnabled()) return { warnings: [] };
  try {
    const msg = await ai().messages.create({
      model: AI_MODEL,
      max_tokens: 600,
      system:
        "You review a home fit-out pricing rate card before it is published. Compare the DRAFT to the BASELINE (Turnkii defaults). " +
        "Flag only genuinely risky or inconsistent values: large swings from baseline (>40%), values that break internal logic " +
        "(e.g. spreadFloor >= spreadCeiling, a package/property factor <=0 or absurdly high, a discount >50%, a style rate far out of line with the others). " +
        "Be terse and specific, cite the field and the concern. If nothing is risky, return an empty list. " +
        'Reply with ONLY JSON: {"warnings": [short strings]}.',
      messages: [{ role: "user", content: `BASELINE:\n${JSON.stringify(baseline)}\n\nDRAFT:\n${JSON.stringify(draft)}` }],
    });
    const parsed = parseJson<{ warnings: string[] }>(textOf(msg));
    return { warnings: Array.isArray(parsed?.warnings) ? parsed!.warnings.map((s) => String(s)).slice(0, 8) : [] };
  } catch {
    return { warnings: [] };
  }
}

/** Plain-language "why this estimate" a client can read, from the computed breakdown. */
export async function explainEstimate(input: EstimateInput, card: RateCard): Promise<string> {
  if (!aiEnabled()) return "";
  const est = estimate(input, card);
  if (!est.ready) return "";
  const facts = [
    `Range: ${range(est.lo, est.hi)} (± ${est.spreadPct}%)`,
    `Blended rate: ${full(est.rate)} / m²`,
    `Area: ${input.area} m², ${est.units} unit(s)`,
    `Programme: ${est.weeks} weeks`,
    `If financed: ${full(est.monthly)} / mo`,
    `Lines: ${est.lines.map((l) => `${l.label} ${full(l.rate)}/m²`).join(", ")}`,
  ].join("\n");
  try {
    const msg = await ai().messages.create({
      model: AI_MODEL,
      max_tokens: 350,
      system:
        "You explain a home-finishing price estimate to a prospective client in 2–3 warm, plain sentences. " +
        "No jargon, British English, no bullet points, no greeting. Make clear it is an indicative range that firms up after the site visit.",
      messages: [{ role: "user", content: facts }],
    });
    return textOf(msg);
  } catch {
    return "";
  }
}
