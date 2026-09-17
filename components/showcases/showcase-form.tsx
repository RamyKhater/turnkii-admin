import type { Showcase } from "@/lib/db/schema";
import { createShowcase, updateShowcase } from "@/lib/showcases/actions";
import { aiDraftShowcaseImage } from "@/lib/showcases/ai";
import { MediaRepeater } from "@/components/content/media-repeater";

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

export function ShowcaseForm({ showcase }: { showcase?: Showcase }) {
  const s = showcase;
  const editing = !!s;
  return (
    <form action={editing ? updateShowcase : createShowcase} className="grid max-w-3xl gap-5 p-6 lg:p-8">
      {editing && <input type="hidden" name="id" value={s!.id} />}

      <div className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="font-serif text-xl">Basics</h2>
        <div className="mt-4 grid gap-4">
          <Field label="Title">
            <input name="title" required defaultValue={s?.title ?? ""} placeholder="Warm Contemporary — finishing & furniture" className={field} />
          </Field>
          <Field label="Subtitle" hint="Location / project descriptor.">
            <input name="subtitle" defaultValue={s?.subtitle ?? ""} placeholder="3-bed villa · New Cairo" className={field} />
          </Field>
          <Field label="Intro">
            <textarea name="intro" rows={2} defaultValue={s?.intro ?? ""} placeholder="A close look at the finishing and furniture we delivered — zoom into any shot to inspect the detail." className={field} />
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="font-serif text-xl">Work images</h2>
        <p className="mt-1 text-sm text-sub">Upload high-resolution photos — clients can zoom right in. Add a category, caption, craftsmanship note and materials/spec for each, or hit <b>✨ AI draft</b> and let AI describe the shot from the image.</p>
        <div className="mt-4">
          <MediaRepeater
            name="items"
            label="Images"
            addLabel="image"
            aiDraft={aiDraftShowcaseImage}
            textFields={[
              { key: "category", label: "Category", placeholder: "Finishing / Furniture / Kitchen…" },
              { key: "caption", label: "Caption", placeholder: "Living room — book-matched veneer wall" },
              { key: "note", label: "Craftsmanship note", placeholder: "Hand-mitred corners, seamless grain match" },
              { key: "spec", label: "Materials / spec", placeholder: "American walnut veneer · matte PU lacquer" },
            ]}
            initial={(s?.items ?? []).map((it) => ({
              image: it.image,
              category: it.category ?? "",
              caption: it.caption ?? "",
              note: it.note ?? "",
              spec: it.spec ?? "",
            }))}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="font-serif text-xl">Call to action</h2>
        <p className="mt-1 text-sm text-sub">An optional button at the end — e.g. “Start your project”.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Button label"><input name="ctaLabel" defaultValue={s?.ctaLabel ?? "Start your project"} className={field} /></Field>
          <Field label="Button link" hint="A URL — defaults to your brief.">
            <input name="ctaHref" defaultValue={s?.ctaHref ?? "https://turnkii.app/#brief"} className={field} />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90">
          {editing ? "Save showcase" : "Create showcase & get link"}
        </button>
        <a href="/showcases" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-ink">Cancel</a>
      </div>
    </form>
  );
}
