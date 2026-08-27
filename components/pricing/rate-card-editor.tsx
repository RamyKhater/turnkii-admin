"use client";
import { useMemo, useState, useTransition } from "react";
import { estimate, full, range, type RateCard } from "@/lib/pricing";
import { publishRateCard, resetRateCard, aiReviewRateCard, aiExplainEstimate } from "@/lib/pricing/actions";

const STYLE_NAMES: Record<string, string> = { warm: "Warm Contemporary", neoclassic: "Neo-Classic Calm", majlis: "Modern Majlis", eclectic: "Layered Eclectic", coastal: "Coastal Light" };
const PKG_NAMES: Record<string, string> = { none: "No furniture", essential: "Essential", signature: "Signature", bespoke: "Bespoke" };
const SVC_NAMES: Record<string, string> = { kitchen: "Kitchen", hvac: "HVAC", shutters: "Shutters & blinds", outdoor: "Outdoor" };
const WEEK_NAMES: Record<string, string> = { finishing: "Finishing", furnishing: "Furnishing", ffe: "FF&E", kitchen: "Kitchen", hvac: "HVAC", shutters: "Shutters", outdoor: "Outdoor" };

type Field = { label: string; value: number; unit: string; step: number; note?: string; set: (v: number) => void };

function num(v: string) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

export function RateCardEditor({ initial, defaults, published, updatedAtISO }:
  { initial: RateCard; defaults: RateCard; published: boolean; updatedAtISO: string | null }) {
  const [card, setCard] = useState<RateCard>(initial);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [pending, start] = useTransition();
  const [testArea, setTestArea] = useState(185);
  const [testUnits, setTestUnits] = useState(1);
  const [testStyle, setTestStyle] = useState("warm");
  const [aiPending, startAi] = useTransition();
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [explanation, setExplanation] = useState<string>("");

  const flat = (k: keyof RateCard, v: number) => { setCard((c) => ({ ...c, [k]: v })); setDirty(true); setSaved(false); };
  const nested = (group: keyof RateCard, key: string, v: number) => {
    setCard((c) => ({ ...c, [group]: { ...(c[group] as Record<string, number>), [key]: v } }));
    setDirty(true); setSaved(false);
  };
  const nestedFields = (group: keyof RateCard, names: Record<string, string> | null, unit: string, step: number, noteFn?: (k: string, v: number) => string): Field[] => {
    const obj = card[group] as Record<string, number>;
    return Object.keys(obj).map((k) => ({
      label: (names && names[k]) || k, value: obj[k], unit, step, note: noteFn ? noteFn(k, obj[k]) : undefined,
      set: (v: number) => nested(group, k, v),
    }));
  };
  const field = (label: string, k: keyof RateCard, unit: string, step: number, note?: string): Field =>
    ({ label, value: card[k] as number, unit, step, note, set: (v) => flat(k, v) });

  const groups: { title: string; hint: string; fields: Field[] }[] = [
    { title: "Style rates", hint: "Finishing, EGP per m² at Signature spec", fields: nestedFields("styleRate", STYLE_NAMES, "/ m²", 100) },
    { title: "Furniture packages", hint: "Multiplier applied to the style rate", fields: nestedFields("packageFactor", PKG_NAMES, "×", 0.01, (k, v) => "adds " + full((card.styleRate[testStyle] || 0) * v) + " / m²") },
    { title: "Add-on services", hint: "EGP per m², on top of finishing", fields: nestedFields("serviceRate", SVC_NAMES, "/ m²", 10) },
    { title: "Property type factor", hint: "Adjusts the finishing rate by unit type", fields: nestedFields("propertyFactor", null, "×", 0.01) },
    { title: "Post-handover care", hint: "Deep cleaning and maintenance visits", fields: nestedFields("care", { cleaningPerM2: "Deep clean", cleaningMin: "Minimum visit", maintenanceCallout: "Maintenance call-out", planDiscount: "Yearly plan discount" }, "", 5) },
    { title: "Programme", hint: "Weeks added per service", fields: [field("Mobilisation", "baseWeeks", "wks", 1), ...nestedFields("serviceWeeks", WEEK_NAMES, "wks", 1)] },
    { title: "Commercials", hint: "Range width, financing and discounts", fields: [
      field("Minimum job value", "minJob", "EGP", 10000, "floor per unit"),
      field("Indicative APR", "apr", "%", 0.25),
      field("Down payment", "downPct", "%", 1),
      field("Save-ahead discount", "saverDiscount", "%", 0.5),
      field("Multi-unit discount", "multiUnitDiscount", "%", 1, "applies from 5 units"),
      field("Range at full confidence", "spreadFloor", "± %", 1),
      field("Range when unqualified", "spreadCeiling", "± %", 1),
    ] },
  ];

  const est = useMemo(() => estimate({
    services: ["finishing", "furnishing", "kitchen", "hvac"],
    area: testArea, units: testUnits, style: testStyle, pkg: "signature", ptype: "Apartment", answered: 8, answerTotal: 8, months: 36,
  }, card), [card, testArea, testUnits, testStyle]);

  function onPublish() {
    setMsg("");
    start(async () => {
      const r = await publishRateCard(card);
      if (r.error) { setMsg(r.error); return; }
      setDirty(false); setSaved(true);
    });
  }
  function onReset() {
    setMsg("");
    start(async () => {
      const r = await resetRateCard();
      if (r.error) { setMsg(r.error); return; }
      setCard(defaults); setDirty(false); setSaved(false); setMsg("Reset to Turnkii defaults.");
    });
  }
  function onReview() {
    setWarnings(null);
    startAi(async () => { const r = await aiReviewRateCard(card); setWarnings(r.warnings); });
  }
  function onExplain() {
    setExplanation("");
    startAi(async () => {
      const r = await aiExplainEstimate({ services: ["finishing", "furnishing", "kitchen", "hvac"], area: testArea, units: testUnits, style: testStyle, pkg: "signature", ptype: "Apartment", answered: 8, answerTotal: 8, months: 36 }, card);
      setExplanation(r.text);
    });
  }

  const inputCls = "w-full min-w-0 border-0 bg-transparent py-2.5 text-base font-semibold text-ink outline-none";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* left: the rate card */}
      <div className="min-w-0 space-y-5">
        <p className="max-w-[62ch] text-sm text-sub">
          {published
            ? <>A custom rate card is <span className="font-bold text-ok">published</span>{updatedAtISO ? ` (updated ${new Date(updatedAtISO).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})` : ""}. The live site estimate uses these numbers.</>
            : <>Running the <span className="font-bold">Turnkii default</span> rate card. Publish to override it.</>}
        </p>

        {groups.map((g) => (
          <div key={g.title} className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="flex flex-wrap items-baseline gap-3 border-b border-line px-5 py-4">
              <span className="text-base font-bold">{g.title}</span>
              <span className="text-xs text-muted">{g.hint}</span>
            </div>
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 xl:grid-cols-3">
              {g.fields.map((f) => (
                <label key={f.label} className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-bold text-sub">{f.label}</span>
                  <span className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 focus-within:border-ink">
                    <input type="number" step={f.step} value={f.value}
                      onChange={(e) => f.set(num(e.target.value))} className={inputCls} />
                    <span className="shrink-0 text-xs font-bold text-muted">{f.unit}</span>
                  </span>
                  {f.note ? <span className="text-[11px] text-muted">{f.note}</span> : null}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* right: live sample + publish */}
      <div className="lg:sticky lg:top-4 h-max space-y-4">
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="bg-ink px-5 py-5 text-cream">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">Sample estimate</div>
            <div className="mt-2 font-serif text-3xl leading-tight">{est.ready ? range(est.lo, est.hi) : "—"}</div>
            <div className="mt-2 text-xs leading-relaxed text-cream/60">
              {(STYLE_NAMES[testStyle] || testStyle)} · finishing + furniture + kitchen + HVAC · {testArea} m² · {testUnits} unit(s)
            </div>
          </div>
          <div className="flex flex-col gap-2.5 px-5 py-4 text-sm">
            {[
              ["Blended rate", full(est.rate) + " / m²"],
              ["Per unit", full(est.perUnit)],
              ["Total", full(est.total)],
              ["Range width", "± " + est.spreadPct + "%"],
              ["Programme", est.weeks + " weeks"],
              ["Monthly at 36 mo", full(est.monthly)],
              ["Save-ahead price", full(est.saver)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline gap-3">
                <span className="flex-1 text-muted">{label}</span>
                <span className="font-bold tabular">{value}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-line px-5 py-3">
            <button onClick={onExplain} disabled={aiPending} className="text-xs font-bold text-olive hover:text-ink disabled:text-muted">
              {aiPending && !explanation ? "Thinking…" : "✨ Explain this estimate for the client"}
            </button>
            {explanation && <p className="mt-2 text-sm leading-relaxed text-sub">{explanation}</p>}
          </div>
          <div className="flex flex-col gap-2.5 bg-paper px-5 py-4">
            <div className="text-xs font-bold uppercase tracking-wider text-sub">Test against a real unit</div>
            <div className="flex gap-2.5">
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">Area m²</span>
                <input type="number" value={testArea} onChange={(e) => setTestArea(num(e.target.value))} className="w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-ink" />
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">Units</span>
                <input type="number" value={testUnits} onChange={(e) => setTestUnits(num(e.target.value))} className="w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-ink" />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(card.styleRate).map((k) => (
                <button key={k} onClick={() => setTestStyle(k)}
                  className={`rounded-full px-3.5 py-2 text-xs font-bold ${testStyle === k ? "bg-ink text-lime" : "border border-line bg-white text-sub hover:border-ink"}`}>
                  {STYLE_NAMES[k] || k}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2.5 rounded-2xl border border-line bg-white p-5">
          <button onClick={onReview} disabled={aiPending}
            className="w-full rounded-full border border-line py-2.5 text-center text-sm font-bold text-olive hover:border-ink disabled:opacity-60">
            {aiPending && warnings === null ? "Reviewing…" : "✨ Review with AI"}
          </button>
          {warnings !== null && (
            warnings.length === 0
              ? <p className="rounded-lg bg-ok/10 px-3 py-2 text-xs font-semibold text-ok">No issues found — the card looks consistent.</p>
              : <ul className="space-y-1 rounded-lg bg-warn/10 p-2.5 text-xs text-warn">{warnings.map((w, i) => <li key={i} className="flex gap-1.5"><span>⚠</span>{w}</li>)}</ul>
          )}
          <button onClick={onPublish} disabled={!dirty || pending}
            className={`w-full rounded-full py-3.5 text-center text-base font-bold ${dirty && !pending ? "bg-lime text-ink hover:brightness-95" : "bg-sand text-muted"}`}>
            {saved ? "Published ✓" : pending ? "Publishing…" : dirty ? "Publish rate card" : "No changes to publish"}
          </button>
          <button onClick={onReset} disabled={pending}
            className="w-full rounded-full py-3 text-center text-sm font-bold text-crit hover:bg-crit/5">
            Reset to Turnkii defaults
          </button>
          <p className="text-center text-xs text-muted">
            {msg ? <span className="font-semibold text-crit">{msg}</span>
              : dirty ? "Unpublished edits — the live site still shows the old numbers."
              : published ? "The live site matches this rate card." : "The live site is on Turnkii defaults."}
          </p>
        </div>
      </div>
    </div>
  );
}
