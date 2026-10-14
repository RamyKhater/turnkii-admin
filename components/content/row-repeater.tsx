"use client";
import { useState } from "react";

type FieldDef = { key: string; label: string; type?: "text" | "color"; width?: string };
type Row = Record<string, string>;

/**
 * Repeatable list of flat text/colour rows (used for a style's palette and
 * furniture list). Serialises to a hidden JSON input that updateStyle parses.
 */
export function RowRepeater({
  name,
  label,
  fields,
  initial = [],
  addLabel = "row",
}: {
  name: string;
  label: string;
  fields: FieldDef[];
  initial?: Row[];
  addLabel?: string;
}) {
  const blank = (): Row => Object.fromEntries(fields.map((f) => [f.key, f.type === "color" ? "#C9A87C" : ""]));
  const [rows, setRows] = useState<Row[]>(initial);

  const update = (i: number, patch: Row) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));
  const move = (i: number, d: number) =>
    setRows((prev) => {
      const a = [...prev];
      const j = i + d;
      if (j < 0 || j >= a.length) return a;
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  const add = () => setRows((prev) => [...prev, blank()]);

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper p-2">
            {fields.map((f) =>
              f.type === "color" ? (
                <input
                  key={f.key}
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(r[f.key] ?? "") ? r[f.key] : "#C9A87C"}
                  onChange={(e) => update(i, { [f.key]: e.target.value })}
                  className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-line p-0.5"
                  aria-label={f.label}
                  title={f.label}
                />
              ) : (
                <input
                  key={f.key}
                  value={r[f.key] ?? ""}
                  onChange={(e) => update(i, { [f.key]: e.target.value })}
                  placeholder={f.label}
                  className={`${f.width ?? "flex-1"} min-w-0 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-ink`}
                />
              ),
            )}
            <div className="ml-auto flex items-center gap-2 text-xs font-semibold">
              <button type="button" onClick={() => move(i, -1)} className="text-sub hover:text-ink" aria-label="Move up">↑</button>
              <button type="button" onClick={() => move(i, 1)} className="text-sub hover:text-ink" aria-label="Move down">↓</button>
              <button type="button" onClick={() => remove(i)} className="text-crit hover:underline">Remove</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-xs text-muted">None yet — the live site falls back to the built-in list until you add rows here.</p>}
      </div>
      <button type="button" onClick={add} className="self-start rounded-full border border-line bg-paper px-4 py-1.5 text-sm font-semibold hover:border-ink">
        + Add {addLabel}
      </button>
    </div>
  );
}
