"use client";
import { useMemo, useState, useTransition } from "react";
import {
  planPayment, renderFinancingNote, preApprovalLimit,
  type FinancingConfig, type FinancingPlan, type FinancingModel,
} from "@/lib/financing";
import { publishFinancing, resetFinancing } from "@/lib/financing/actions";

function num(v: string) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
const MODELS: { value: FinancingModel; label: string; hint: string }[] = [
  { value: "even", label: "Even split", hint: "amount ÷ term — interest-free" },
  { value: "amortized", label: "Amortised", hint: "bank rate over the term" },
  { value: "saver", label: "Save-ahead", hint: "discount, then even split" },
];

const inputCls = "w-full min-w-0 rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-ink";
const labelCls = "flex min-w-0 flex-col gap-1.5";
const capCls = "text-xs font-bold text-sub";

export function FinancingEditor({ initial, defaults, published, updatedAtISO }:
  { initial: FinancingConfig; defaults: FinancingConfig; published: boolean; updatedAtISO: string | null }) {
  const [cfg, setCfg] = useState<FinancingConfig>(initial);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  // sample controls
  const [sampleKey, setSampleKey] = useState(initial.plans[0]?.key ?? "");
  const [sampleAmount, setSampleAmount] = useState(2_000_000);
  const [sampleTerm, setSampleTerm] = useState(initial.plans[0]?.defaultTerm ?? 24);
  const [sampleIncome, setSampleIncome] = useState(60_000);

  function touch() { setDirty(true); setSaved(false); }
  function setTop<K extends keyof FinancingConfig>(k: K, v: FinancingConfig[K]) { setCfg((c) => ({ ...c, [k]: v })); touch(); }
  function setPre(k: keyof FinancingConfig["preApproval"], v: number) {
    setCfg((c) => ({ ...c, preApproval: { ...c.preApproval, [k]: v } })); touch();
  }
  function setPlan(i: number, patch: Partial<FinancingPlan>) {
    setCfg((c) => ({ ...c, plans: c.plans.map((p, j) => (j === i ? { ...p, ...patch } : p)) })); touch();
  }
  function addPlan() {
    const key = `plan${cfg.plans.length + 1}`;
    setCfg((c) => ({ ...c, plans: [...c.plans, {
      key, name: "New plan", terms: "12 months", body: "Describe this plan.", fit: "Everyone",
      model: "even", unit: "months", minTerm: 6, maxTerm: 24, defaultTerm: 12, monthlyRate: 0, discountPct: 0,
      note: "Interest-free instalments.", published: false,
    }] }));
    touch();
  }
  function removePlan(i: number) { setCfg((c) => ({ ...c, plans: c.plans.filter((_, j) => j !== i) })); touch(); }
  function movePlan(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= cfg.plans.length) return;
    setCfg((c) => { const p = [...c.plans]; [p[i], p[j]] = [p[j], p[i]]; return { ...c, plans: p }; });
    touch();
  }

  const samplePlan = cfg.plans.find((p) => p.key === sampleKey) ?? cfg.plans[0];
  const sample = useMemo(() => {
    if (!samplePlan) return null;
    const term = samplePlan.unit === "milestones" ? samplePlan.maxTerm : Math.min(Math.max(sampleTerm, samplePlan.minTerm), samplePlan.maxTerm);
    const pay = planPayment(samplePlan, sampleAmount, term);
    return { term, pay, note: renderFinancingNote(samplePlan, sampleAmount, cfg) };
  }, [samplePlan, sampleAmount, sampleTerm, cfg]);
  const limit = useMemo(() => preApprovalLimit(sampleIncome, cfg), [sampleIncome, cfg]);
  const egp = (v: number) => "EGP " + Math.round(v).toLocaleString("en-US");

  function onPublish() {
    setMsg("");
    start(async () => {
      const r = await publishFinancing(cfg);
      if (r.error) { setMsg(r.error); return; }
      setDirty(false); setSaved(true);
    });
  }
  function onReset() {
    setMsg("");
    start(async () => {
      const r = await resetFinancing();
      if (r.error) { setMsg(r.error); return; }
      setCfg(defaults); setDirty(false); setSaved(false); setMsg("Reset to Turnkii defaults.");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* left: plans + params */}
      <div className="min-w-0 space-y-5">
        <p className="max-w-[62ch] text-sm text-sub">
          {published
            ? <>Custom financing is <span className="font-bold text-ok">published</span>{updatedAtISO ? ` (updated ${new Date(updatedAtISO).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})` : ""}. The site's plans and pre-approval use these.</>
            : <>Running the <span className="font-bold">Turnkii default</span> plans. Publish to override them.</>}
        </p>

        {/* Homepage copy */}
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-5 py-4"><span className="text-base font-bold">Financing band</span> <span className="text-xs text-muted">heading &amp; sub-copy on the homepage</span></div>
          <div className="grid gap-4 px-5 py-4">
            <label className={labelCls}><span className={capCls}>Heading</span>
              <input value={cfg.headline} onChange={(e) => setTop("headline", e.target.value)} className={inputCls} /></label>
            <label className={labelCls}><span className={capCls}>Sub-copy</span>
              <textarea value={cfg.blurb} onChange={(e) => setTop("blurb", e.target.value)} rows={2} className={inputCls} /></label>
          </div>
        </div>

        {/* Plans */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold">Instalment plans</span>
            <button onClick={addPlan} className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-olive hover:border-ink">+ Add plan</button>
          </div>
          {cfg.plans.map((p, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-5 py-3">
                <span className="font-bold">{p.name || "Untitled"}</span>
                {!p.published && <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold uppercase text-muted">Hidden</span>}
                <div className="ml-auto flex items-center gap-1.5">
                  <button onClick={() => movePlan(i, -1)} disabled={i === 0} className="rounded px-1.5 text-sub hover:text-ink disabled:opacity-30" title="Move up">↑</button>
                  <button onClick={() => movePlan(i, 1)} disabled={i === cfg.plans.length - 1} className="rounded px-1.5 text-sub hover:text-ink disabled:opacity-30" title="Move down">↓</button>
                  <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-xs font-bold text-sub">
                    <input type="checkbox" checked={p.published} onChange={(e) => setPlan(i, { published: e.target.checked })} /> Published
                  </label>
                  <button onClick={() => removePlan(i)} className="ml-1 rounded px-1.5 text-crit hover:bg-crit/5" title="Remove">✕</button>
                </div>
              </div>
              <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 xl:grid-cols-3">
                <label className={labelCls}><span className={capCls}>Name</span>
                  <input value={p.name} onChange={(e) => setPlan(i, { name: e.target.value })} className={inputCls} /></label>
                <label className={labelCls}><span className={capCls}>Terms label</span>
                  <input value={p.terms} onChange={(e) => setPlan(i, { terms: e.target.value })} className={inputCls} /></label>
                <label className={labelCls}><span className={capCls}>Audience</span>
                  <input value={p.fit} onChange={(e) => setPlan(i, { fit: e.target.value })} className={inputCls} /></label>
                <label className={`${labelCls} sm:col-span-2 xl:col-span-3`}><span className={capCls}>Description</span>
                  <textarea value={p.body} onChange={(e) => setPlan(i, { body: e.target.value })} rows={2} className={inputCls} /></label>
                <label className={labelCls}><span className={capCls}>Calculation model</span>
                  <select value={p.model} onChange={(e) => setPlan(i, { model: e.target.value as FinancingModel })} className={inputCls}>
                    {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <span className="text-[11px] text-muted">{MODELS.find((m) => m.value === p.model)?.hint}</span>
                </label>
                <label className={labelCls}><span className={capCls}>Term unit</span>
                  <select value={p.unit} onChange={(e) => setPlan(i, { unit: e.target.value as "months" | "milestones" })} className={inputCls}>
                    <option value="months">Months</option>
                    <option value="milestones">Milestones (fixed)</option>
                  </select></label>
                <label className={labelCls}><span className={capCls}>Monthly rate %</span>
                  <input type="number" step={0.05} value={p.monthlyRate * 100}
                    onChange={(e) => setPlan(i, { monthlyRate: num(e.target.value) / 100 })}
                    disabled={p.model !== "amortized"} className={`${inputCls} disabled:opacity-40`} />
                  <span className="text-[11px] text-muted">amortised plans only</span></label>
                <label className={labelCls}><span className={capCls}>Save-ahead discount %</span>
                  <input type="number" step={0.5} value={p.discountPct}
                    onChange={(e) => setPlan(i, { discountPct: num(e.target.value) })}
                    disabled={p.model !== "saver"} className={`${inputCls} disabled:opacity-40`} />
                  <span className="text-[11px] text-muted">save-ahead plans only</span></label>
                <label className={labelCls}><span className={capCls}>Min term</span>
                  <input type="number" value={p.minTerm} onChange={(e) => setPlan(i, { minTerm: num(e.target.value) })} className={inputCls} /></label>
                <label className={labelCls}><span className={capCls}>Max term</span>
                  <input type="number" value={p.maxTerm} onChange={(e) => setPlan(i, { maxTerm: num(e.target.value) })} className={inputCls} /></label>
                <label className={labelCls}><span className={capCls}>Default term</span>
                  <input type="number" value={p.defaultTerm} onChange={(e) => setPlan(i, { defaultTerm: num(e.target.value) })} className={inputCls} /></label>
                <label className={`${labelCls} sm:col-span-2 xl:col-span-3`}><span className={capCls}>Calculator footnote</span>
                  <input value={p.note} onChange={(e) => setPlan(i, { note: e.target.value })} className={inputCls} />
                  <span className="text-[11px] text-muted">Tokens: {"{cap}"} (bank ceiling), {"{amount}"}, {"{discounted}"}</span></label>
              </div>
            </div>
          ))}
        </div>

        {/* Pre-approval */}
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-5 py-4"><span className="text-base font-bold">Pre-approval sizing</span> <span className="text-xs text-muted">the affordability rule behind the indicative limit</span></div>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className={labelCls}><span className={capCls}>Income share %</span>
              <input type="number" step={1} value={Math.round(cfg.preApproval.incomeRatio * 100)}
                onChange={(e) => setPre("incomeRatio", num(e.target.value) / 100)} className={inputCls} />
              <span className="text-[11px] text-muted">of monthly income to instalment</span></label>
            <label className={labelCls}><span className={capCls}>Horizon (months)</span>
              <input type="number" value={cfg.preApproval.termMonths} onChange={(e) => setPre("termMonths", num(e.target.value))} className={inputCls} /></label>
            <label className={labelCls}><span className={capCls}>Max limit (EGP)</span>
              <input type="number" step={1_000_000} value={cfg.preApproval.maxLimit} onChange={(e) => setPre("maxLimit", num(e.target.value))} className={inputCls} /></label>
            <label className={labelCls}><span className={capCls}>Round to (EGP)</span>
              <input type="number" step={10_000} value={cfg.preApproval.rounding} onChange={(e) => setPre("rounding", num(e.target.value))} className={inputCls} /></label>
          </div>
        </div>
      </div>

      {/* right: live sample + publish */}
      <div className="lg:sticky lg:top-4 h-max space-y-4">
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="bg-ink px-5 py-5 text-cream">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">Payment sample</div>
            <div className="mt-2 font-serif text-3xl leading-tight">{sample ? egp(sample.pay) : "—"}</div>
            <div className="mt-1 text-xs text-cream/60">
              {samplePlan ? `${samplePlan.name} · ${sample?.term} ${samplePlan.unit === "milestones" ? "milestones" : "months"}` : "—"}
            </div>
            {sample?.note && <div className="mt-2 text-xs leading-relaxed text-cream/60">{sample.note}</div>}
          </div>
          <div className="flex flex-col gap-2.5 bg-paper px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {cfg.plans.map((p) => (
                <button key={p.key} onClick={() => { setSampleKey(p.key); setSampleTerm(p.defaultTerm); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${sampleKey === p.key ? "bg-ink text-lime" : "border border-line bg-white text-sub hover:border-ink"}`}>
                  {p.name}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">Project budget (EGP)</span>
              <input type="number" step={100_000} value={sampleAmount} onChange={(e) => setSampleAmount(num(e.target.value))} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-ink" />
            </label>
            {samplePlan && samplePlan.unit === "months" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted">Term: {sampleTerm} months</span>
                <input type="range" min={samplePlan.minTerm} max={samplePlan.maxTerm} step={1} value={Math.min(Math.max(sampleTerm, samplePlan.minTerm), samplePlan.maxTerm)}
                  onChange={(e) => setSampleTerm(num(e.target.value))} className="w-full accent-olive" />
              </label>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="border-b border-line px-5 py-4"><span className="text-sm font-bold">Pre-approval sample</span></div>
          <div className="flex flex-col gap-2.5 px-5 py-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">Monthly income (EGP)</span>
              <input type="number" step={5_000} value={sampleIncome} onChange={(e) => setSampleIncome(num(e.target.value))} className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold outline-none focus:border-ink" />
            </label>
            <div className="flex items-baseline gap-3 text-sm"><span className="flex-1 text-muted">Indicative limit</span><span className="font-bold tabular">{egp(limit)}</span></div>
            <div className="flex items-baseline gap-3 text-sm"><span className="flex-1 text-muted">Max monthly</span><span className="font-bold tabular">{egp(sampleIncome * cfg.preApproval.incomeRatio)}</span></div>
          </div>
        </div>

        <div className="space-y-2.5 rounded-2xl border border-line bg-white p-5">
          <button onClick={onPublish} disabled={!dirty || pending}
            className={`w-full rounded-full py-3.5 text-center text-base font-bold ${dirty && !pending ? "bg-lime text-ink hover:brightness-95" : "bg-sand text-muted"}`}>
            {saved ? "Published ✓" : pending ? "Publishing…" : dirty ? "Publish financing" : "No changes to publish"}
          </button>
          <button onClick={onReset} disabled={pending}
            className="w-full rounded-full py-3 text-center text-sm font-bold text-crit hover:bg-crit/5">
            Reset to Turnkii defaults
          </button>
          <p className="text-center text-xs text-muted">
            {msg ? <span className="font-semibold text-crit">{msg}</span>
              : dirty ? "Unpublished edits — the live site still shows the old plans."
              : published ? "The live site matches this financing config." : "The live site is on Turnkii defaults."}
          </p>
        </div>
      </div>
    </div>
  );
}
