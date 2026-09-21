import type { ProjectShowcase } from "@/lib/db/schema";
import { createProjectShowcase, updateProjectShowcase } from "@/lib/project-showcases/actions";
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

export function ProjectShowcaseForm({ showcase }: { showcase?: ProjectShowcase }) {
  const s = showcase;
  const editing = !!s;
  return (
    <form action={editing ? updateProjectShowcase : createProjectShowcase} className="grid max-w-3xl gap-5 p-6 lg:p-8">
      {editing && <input type="hidden" name="id" value={s!.id} />}

      <div className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="font-serif text-xl">Basics</h2>
        <div className="mt-4 grid gap-4">
          <Field label="Title"><input name="title" required defaultValue={s?.title ?? ""} placeholder="Marassi villa — full delivery" className={field} /></Field>
          <Field label="Subtitle" hint="Location / project descriptor."><input name="subtitle" defaultValue={s?.subtitle ?? ""} placeholder="3-bed villa · North Coast" className={field} /></Field>
          <Field label="Intro"><textarea name="intro" rows={2} defaultValue={s?.intro ?? ""} placeholder="The full project, service by service — zoom into any shot to inspect the quality." className={field} /></Field>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="font-serif text-xl">Work images, by service</h2>
        <p className="mt-1 text-sm text-sub">Upload high-resolution photos and set each one's <b>service</b> (Finishing, Furnishing, Kitchens…). The showcase groups them into a section per service. Add a caption, craftsmanship note and spec, or hit <b>✨ AI draft</b>.</p>
        <div className="mt-4">
          <MediaRepeater
            name="items"
            label="Images"
            addLabel="image"
            aiDraft={aiDraftShowcaseImage}
            textFields={[
              { key: "category", label: "Service", placeholder: "Finishing / Furnishing / Kitchens…" },
              { key: "caption", label: "Caption", placeholder: "Living room — book-matched veneer wall" },
              { key: "note", label: "Craftsmanship note", placeholder: "Hand-mitred corners, seamless grain match" },
              { key: "spec", label: "Materials / spec", placeholder: "American walnut veneer · matte PU lacquer" },
            ]}
            initial={(s?.items ?? []).map((it) => ({ image: it.image, category: it.category ?? "", caption: it.caption ?? "", note: it.note ?? "", spec: it.spec ?? "" }))}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="font-serif text-xl">Supplier / contractor credits <span className="text-sm font-normal text-muted">— optional</span></h2>
        <p className="mt-1 text-sm text-sub">Credit who delivered a service: upload their <b>logo</b> and set the <b>service</b> it applies to (must match a service above). It shows as “Delivered by …” on that section. Leave empty to show no credit.</p>
        <div className="mt-4">
          <MediaRepeater
            name="credits"
            label="Logos"
            addLabel="supplier"
            textFields={[
              { key: "service", label: "Service (matches a section above)", placeholder: "Finishing" },
              { key: "name", label: "Supplier / contractor name", placeholder: "Naos Contracting" },
            ]}
            initial={(s?.credits ?? []).map((c) => ({ image: c.image, service: c.service ?? "", name: c.name ?? "" }))}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="font-serif text-xl">Call to action</h2>
        <p className="mt-1 text-sm text-sub">An optional button at the end.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Button label"><input name="ctaLabel" defaultValue={s?.ctaLabel ?? "Start your project"} className={field} /></Field>
          <Field label="Button link" hint="A URL — defaults to your brief."><input name="ctaHref" defaultValue={s?.ctaHref ?? "https://turnkii.app/#brief"} className={field} /></Field>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90">{editing ? "Save showcase" : "Create showcase & get link"}</button>
        <a href="/project-showcases" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-ink">Cancel</a>
      </div>
    </form>
  );
}
