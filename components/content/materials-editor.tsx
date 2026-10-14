"use client";
import { useRef, useState } from "react";
import { uploadImage } from "./downscale";

export type MaterialOption = { name: string; spec: string; hex: string; image: string; avail: boolean };
export type MaterialGroup = { group: string; options: MaterialOption[] };

const blankOption = (): MaterialOption => ({ name: "", spec: "", hex: "#C9A87C", image: "", avail: true });
const blankGroup = (): MaterialGroup => ({ group: "", options: [blankOption()] });

/**
 * Nested editor for a style's materials: groups (e.g. "Flooring") each holding
 * options with a name, spec, colour, optional sample image and an in-stock flag.
 * Serialises to a hidden JSON input that updateStyle parses.
 */
export function MaterialsEditor({ name, initial = [] }: { name: string; initial?: MaterialGroup[] }) {
  const [groups, setGroups] = useState<MaterialGroup[]>(initial);

  const setGroup = (gi: number, patch: Partial<MaterialGroup>) =>
    setGroups((prev) => prev.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const setOption = (gi: number, oi: number, patch: Partial<MaterialOption>) =>
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gi ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : g,
      ),
    );
  const addGroup = () => setGroups((prev) => [...prev, blankGroup()]);
  const removeGroup = (gi: number) => setGroups((prev) => prev.filter((_, i) => i !== gi));
  const moveGroup = (gi: number, d: number) =>
    setGroups((prev) => {
      const a = [...prev];
      const j = gi + d;
      if (j < 0 || j >= a.length) return a;
      [a[gi], a[j]] = [a[j], a[gi]];
      return a;
    });
  const addOption = (gi: number) => setGroup(gi, { options: [...groups[gi].options, blankOption()] });
  const removeOption = (gi: number, oi: number) =>
    setGroup(gi, { options: groups[gi].options.filter((_, j) => j !== oi) });

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={JSON.stringify(groups)} />
      <span className="text-xs font-bold uppercase tracking-wider text-muted">Materials</span>
      <div className="flex flex-col gap-4">
        {groups.map((g, gi) => (
          <div key={gi} className="flex flex-col gap-3 rounded-xl border border-line p-3">
            <div className="flex items-center gap-2">
              <input
                value={g.group}
                onChange={(e) => setGroup(gi, { group: e.target.value })}
                placeholder="Group name (e.g. Flooring)"
                className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-semibold outline-none focus:border-ink"
              />
              <button type="button" onClick={() => moveGroup(gi, -1)} className="px-1 text-xs font-semibold text-sub hover:text-ink" aria-label="Move group up">↑</button>
              <button type="button" onClick={() => moveGroup(gi, 1)} className="px-1 text-xs font-semibold text-sub hover:text-ink" aria-label="Move group down">↓</button>
              <button type="button" onClick={() => removeGroup(gi)} className="text-xs font-semibold text-crit hover:underline">Remove group</button>
            </div>
            <div className="flex flex-col gap-2">
              {g.options.map((o, oi) => (
                <OptionRow
                  key={oi}
                  option={o}
                  onChange={(patch) => setOption(gi, oi, patch)}
                  onRemove={() => removeOption(gi, oi)}
                />
              ))}
            </div>
            <button type="button" onClick={() => addOption(gi)} className="self-start rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold hover:border-ink">
              + Add option
            </button>
          </div>
        ))}
        {groups.length === 0 && <p className="text-xs text-muted">No materials yet — the live site falls back to the built-in list until you add groups here.</p>}
      </div>
      <button type="button" onClick={addGroup} className="self-start rounded-full border border-line bg-paper px-4 py-1.5 text-sm font-semibold hover:border-ink">
        + Add group
      </button>
    </div>
  );
}

function OptionRow({ option, onChange, onRemove }: { option: MaterialOption; onChange: (p: Partial<MaterialOption>) => void; onRemove: () => void }) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    try {
      onChange({ image: await uploadImage(file) });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-3 rounded-lg border border-line bg-paper p-2.5">
      <div className="flex flex-col items-center gap-1.5">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-sand text-[10px] text-muted">
          {option.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={option.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="h-full w-full" style={{ background: option.hex }} />
          )}
        </div>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-[11px] font-semibold hover:border-ink disabled:opacity-60">
          {busy ? "…" : option.image ? "Replace" : "Sample"}
        </button>
        {option.image && (
          <button type="button" onClick={() => onChange({ image: "" })} className="text-[11px] font-semibold text-crit hover:underline">Clear</button>
        )}
        <input ref={fileRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex gap-2">
          <input value={option.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Name (e.g. Engineered oak)" className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-ink" />
          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(option.hex) ? option.hex : "#C9A87C"} onChange={(e) => onChange({ hex: e.target.value })} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-line bg-paper p-0.5" aria-label="Fallback colour" title="Fallback colour (shown when no sample image)" />
        </div>
        <input value={option.spec} onChange={(e) => onChange({ spec: e.target.value })} placeholder="Spec (e.g. 14mm, 190mm board, brushed matt)" className="w-full rounded-lg border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-ink" />
        <div className="flex items-center gap-4 text-xs font-semibold">
          <label className="flex items-center gap-1.5 text-sub">
            <input type="checkbox" checked={option.avail} onChange={(e) => onChange({ avail: e.target.checked })} className="h-3.5 w-3.5 accent-olive" />
            In stock
          </label>
          <button type="button" onClick={onRemove} className="ml-auto text-crit hover:underline">Remove</button>
        </div>
      </div>
    </div>
  );
}
