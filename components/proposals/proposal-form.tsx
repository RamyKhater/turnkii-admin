import type { Proposal } from "@/lib/db/schema";
import { createProposal, updateProposal } from "@/lib/proposals/actions";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink";
const labelC = "block text-xs font-bold uppercase tracking-wider text-muted";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelC}>{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-sub">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-6">
      <h2 className="font-serif text-xl">{title}</h2>
      <div className="mt-4 grid gap-4">{children}</div>
    </div>
  );
}

const linesToText = (rows: { [k: string]: string | undefined }[] | null | undefined, keys: string[]) =>
  (rows ?? []).map((r) => keys.map((k) => r[k] ?? "").join(" | ").replace(/(\s\|\s)+$/, "")).join("\n");

export function ProposalForm({ proposal }: { proposal?: Proposal }) {
  const p = proposal;
  const editing = !!p;
  return (
    <form action={editing ? updateProposal : createProposal} className="grid max-w-3xl gap-5 p-6 lg:p-8">
      {editing && <input type="hidden" name="id" value={p!.id} />}

      <Section title="Basics">
        <Field label="Proposal title">
          <input name="title" required defaultValue={p?.title ?? ""} placeholder="Finishing & furnishing — Marassi villa" className={field} />
        </Field>
        <Field label="Client name">
          <input name="clientName" defaultValue={p?.clientName ?? ""} placeholder="e.g. Mr Karim Hassan" className={field} />
        </Field>
        <Field label="Personal intro" hint="A short note shown at the top of the page.">
          <textarea name="intro" rows={3} defaultValue={p?.intro ?? ""} placeholder="Thanks for the visit — here's the direction we'd propose for your unit…" className={field} />
        </Field>
      </Section>

      <Section title="Design direction">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Style name">
            <input name="styleName" defaultValue={p?.styleName ?? ""} placeholder="Warm Contemporary" className={field} />
          </Field>
          <Field label="Palette">
            <input name="palette" defaultValue={p?.palette ?? ""} placeholder="Sand · Walnut · Olive" className={field} />
          </Field>
        </div>
        <Field label="Direction note">
          <textarea name="directionNote" rows={2} defaultValue={p?.directionNote ?? ""} placeholder="Soft, photogenic and easy to let — cane, walnut and sand plaster." className={field} />
        </Field>
        <Field label="Reference images" hint="One image URL per line (mood / reference shots).">
          <textarea name="images" rows={3} defaultValue={(p?.images ?? []).join("\n")} placeholder={"https://turnkii.app/assets/style-warm.jpg\nhttps://…"} className={field} />
        </Field>
      </Section>

      <Section title="Scope & investment">
        <Field label="Scope items" hint="One per line — Label | note | price (note and price optional).">
          <textarea name="scopeItems" rows={5} defaultValue={linesToText(p?.scopeItems, ["label", "note", "price"])} placeholder={"Property finishing | Bare shell to painted, lit & sealed | EGP 620k\nKitchen | Cabinetry, stone, appliances | EGP 180k\nFurniture package | Signature tier | EGP 340k"} className={field} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Headline price / range">
            <input name="priceLabel" defaultValue={p?.priceLabel ?? ""} placeholder="EGP 1.2M – 1.6M" className={field} />
          </Field>
          <Field label="Financing note">
            <input name="financingNote" defaultValue={p?.financingNote ?? ""} placeholder="Milestone payments · bank plans to 60 months" className={field} />
          </Field>
        </div>
      </Section>

      <Section title="Timeline & next steps">
        <Field label="Timeline phases" hint="One per line — Phase | duration | note (duration and note optional).">
          <textarea name="timelineItems" rows={4} defaultValue={linesToText(p?.timelineItems, ["phase", "duration", "note"])} placeholder={"Survey & scope | 1 week | Measurements, MEP, photos\nFinishing | 6 weeks | Weekly photo reports\nFurnishing & handover | 3 weeks | One delivery window"} className={field} />
        </Field>
        <Field label="Timeline note">
          <input name="timelineNote" defaultValue={p?.timelineNote ?? ""} placeholder="Fixed programme confirmed after the survey." className={field} />
        </Field>
      </Section>

      <Section title="Client action">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Action type">
            <select name="ctaType" defaultValue={p?.ctaType ?? "approve"} className={field}>
              <option value="approve">Approve this direction</option>
              <option value="call">Book a call</option>
              <option value="whatsapp">WhatsApp us</option>
              <option value="none">No action</option>
            </select>
          </Field>
          <Field label="Button label">
            <input name="ctaLabel" defaultValue={p?.ctaLabel ?? ""} placeholder="Approve this direction" className={field} />
          </Field>
          <Field label="Value" hint="Phone / WhatsApp number or booking URL (not needed for Approve).">
            <input name="ctaValue" defaultValue={p?.ctaValue ?? ""} placeholder="+20 1xx xxx xxxx" className={field} />
          </Field>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90">
          {editing ? "Save proposal" : "Create proposal & get link"}
        </button>
        <a href="/proposals" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-ink">Cancel</a>
      </div>
    </form>
  );
}
