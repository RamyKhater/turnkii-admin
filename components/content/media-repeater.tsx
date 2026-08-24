"use client";
import { useRef, useState } from "react";

type TextField = { key: string; label: string; placeholder?: string };
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
}: {
  name: string;
  label: string;
  textFields?: TextField[];
  initial?: Item[];
  addLabel?: string;
}) {
  const [items, setItems] = useState<Item[]>(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

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
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      update(i, { image: json.url });
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
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {textFields.map((f) => (
                <input
                  key={f.key}
                  value={it[f.key] ?? ""}
                  onChange={(e) => update(i, { [f.key]: e.target.value })}
                  placeholder={f.placeholder ?? f.label}
                  className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-ink"
                />
              ))}
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
