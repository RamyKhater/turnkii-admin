"use client";
import { useRef, useState } from "react";
import { uploadImage } from "./downscale";

type TextField = { key: string; label: string; placeholder?: string; options?: string[] };
type Item = Record<string, string>; // always has "image", plus any text fields

/**
 * Repeatable list of images each with optional text fields (used for style
 * close-ups: image+label+note, and handover galleries: image only). Serialises
 * to a hidden JSON input the server action parses.
 */
export function MediaRepeater({
  name,
  label,
  textFields = [],
  initial = [],
  addLabel = "item",
  aiDraft,
  aiLabel = "✨ AI draft",
}: {
  name: string;
  label: string;
  textFields?: TextField[];
  initial?: Item[];
  addLabel?: string;
  /** Optional: draft this item's text fields from its image with one click. */
  aiDraft?: (imageUrl: string) => Promise<Record<string, string | undefined>>;
  aiLabel?: string;
}) {
  const [items, setItems] = useState<Item[]>(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [aiBusy, setAiBusy] = useState<number | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function draft(i: number, image: string) {
    if (!aiDraft) return;
    setAiBusy(i);
    try {
      const out = await aiDraft(image);
      const patch: Record<string, string> = {};
      textFields.forEach((f) => { const v = out?.[f.key]; if (typeof v === "string" && v) patch[f.key] = v; });
      if (Object.keys(patch).length) update(i, patch);
      else alert("AI couldn't draft this one — add the details manually, or check the image is uploaded.");
    } catch {
      alert("AI draft failed. Please try again.");
    } finally {
      setAiBusy(null);
    }
  }

  const update = (i: number, patch: Record<string, string>) =>
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => setItems((prev) => prev.filter((_, j) => j !== i));
  const move = (i: number, d: number) =>
    setItems((prev) => {
      const a = [...prev];
      const j = i + d;
      if (j < 0 || j >= a.length) return a;
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  const add = () =>
    setItems((prev) => [...prev, { image: "", ...Object.fromEntries(textFields.map((f) => [f.key, ""])) }]);

  async function upload(i: number, file: File) {
    setBusy(i);
    try {
      update(i, { image: await uploadImage(file) });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
      <div className="flex flex-col gap-3">
        {items.map((it, i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-line p-3">
            <div className="flex flex-col items-center gap-1.5">
              <div className="grid h-20 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-sand text-[11px] text-muted">
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  "No image"
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRefs.current[i]?.click()}
                disabled={busy === i}
                className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold hover:border-ink disabled:opacity-60"
              >
                {busy === i ? "Uploading…" : it.image ? "Replace" : "Upload"}
              </button>
              <input
                ref={(el) => { fileRefs.current[i] = el; }}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(i, f); }}
              />
              {aiDraft && it.image && (
                <button
                  type="button"
                  onClick={() => draft(i, it.image)}
                  disabled={aiBusy === i}
                  className="rounded-full border border-olive/40 bg-lime/15 px-3 py-1 text-xs font-semibold text-olive hover:bg-lime/30 disabled:opacity-60"
                >
                  {aiBusy === i ? "Drafting…" : aiLabel}
                </button>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {textFields.map((f) => (
                <input
                  key={f.key}
                  value={it[f.key] ?? ""}
                  onChange={(e) => update(i, { [f.key]: e.target.value })}
                  placeholder={f.placeholder ?? f.label}
                  list={f.options && f.options.length ? `${name}-${f.key}-opts` : undefined}
                  className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-ink"
                />
              ))}
              {textFields.map((f) =>
                f.options && f.options.length ? (
                  <datalist key={`dl-${f.key}`} id={`${name}-${f.key}-opts`}>
                    {f.options.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                ) : null,
              )}
              <div className="mt-auto flex gap-3 text-xs font-semibold">
                <button type="button" onClick={() => move(i, -1)} className="text-sub hover:text-ink" aria-label="Move up">↑</button>
                <button type="button" onClick={() => move(i, 1)} className="text-sub hover:text-ink" aria-label="Move down">↓</button>
                <button type="button" onClick={() => remove(i)} className="ml-auto text-crit hover:underline">Remove</button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted">None yet.</p>}
      </div>
      <button
        type="button"
        onClick={add}
        className="self-start rounded-full border border-line bg-paper px-4 py-1.5 text-sm font-semibold hover:border-ink"
      >
        + Add {addLabel}
      </button>
    </div>
  );
}
