"use client";
import { useMemo, useState, useTransition } from "react";
import { saveCopyOverrides } from "@/lib/content/actions";

type Page = { slug: string; title: string; keys: string[] };

export function SiteCopyEditor({
  pages,
  overrides,
  total,
}: {
  pages: Page[];
  overrides: Record<string, string>;
  total: number;
}) {
  // Each visible string is edited once and applies everywhere it appears, so
  // de-duplicate across pages: a string belongs to the first page it shows up on.
  const groups = useMemo(() => {
    const seen = new Set<string>();
    return pages
      .map((p) => {
        const keys = p.keys.filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
        return { slug: p.slug, title: p.title, keys };
      })
      .filter((g) => g.keys.length);
  }, [pages]);

  const [edits, setEdits] = useState<Record<string, string>>({ ...overrides });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<number | null>(null);

  const valueOf = (k: string) => (k in edits ? edits[k] : k);
  const isChanged = (k: string) => {
    const v = edits[k];
    return v != null && v.trim() !== "" && v !== k;
  };
  const changedCount = Object.keys(edits).filter(isChanged).length;

  const query = q.trim().toLowerCase();
  const matches = (k: string) => !query || k.toLowerCase().includes(query) || valueOf(k).toLowerCase().includes(query);

  function setField(k: string, v: string) {
    setEdits((e) => ({ ...e, [k]: v }));
    setSaved(null);
  }
  function reset(k: string) {
    setEdits((e) => {
      const n = { ...e };
      delete n[k];
      return n;
    });
    setSaved(null);
  }
  function toggle(slug: string) {
    setOpen((o) => {
      const n = new Set(o);
      n.has(slug) ? n.delete(slug) : n.add(slug);
      return n;
    });
  }
  function save() {
    const map: Record<string, string> = {};
    for (const k of Object.keys(edits)) if (isChanged(k)) map[k] = edits[k];
    start(async () => {
      const r = await saveCopyOverrides(map);
      setSaved(r?.count ?? Object.keys(map).length);
    });
  }

  return (
    <div className="max-w-3xl">
      {/* controls */}
      <div className="sticky top-0 z-10 -mx-6 mb-4 flex flex-wrap items-center gap-3 border-b border-line bg-cream/90 px-6 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${total} strings…`}
          className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-ink"
          aria-label="Search site copy"
        />
        <span className="text-xs font-semibold text-muted tabular">
          {changedCount} edited
        </span>
        <button
          onClick={save}
          disabled={pending || changedCount === 0}
          className="rounded-full bg-ink px-5 py-2 text-sm font-bold text-cream disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save & publish"}
        </button>
      </div>
      {saved != null && (
        <p className="mb-4 rounded-xl bg-ok/15 px-4 py-3 text-sm font-semibold text-ok">
          Saved {saved} override{saved === 1 ? "" : "s"} — the site is rebuilding (about a minute).
        </p>
      )}
      <p className="mb-5 text-sm text-sub">
        Change any wording below. Blank or unchanged fields keep the original text. Edits apply everywhere
        that exact phrase appears on the site.
      </p>

      <div className="space-y-3">
        {groups.map((g) => {
          const shown = g.keys.filter(matches);
          if (query && shown.length === 0) return null;
          const isOpen = !!query || open.has(g.slug);
          const editedHere = g.keys.filter(isChanged).length;
          return (
            <div key={g.slug} className="overflow-hidden rounded-2xl border border-line bg-paper">
              <button
                onClick={() => toggle(g.slug)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="font-semibold">
                  {g.title}
                  <span className="ml-2 font-mono text-xs text-muted">{g.slug}</span>
                </span>
                <span className="flex items-center gap-3 text-xs text-muted">
                  {editedHere > 0 && <span className="font-bold text-olive">{editedHere} edited</span>}
                  <span className="tabular">{query ? shown.length : g.keys.length}</span>
                  <span aria-hidden>{isOpen ? "▾" : "▸"}</span>
                </span>
              </button>
              {isOpen && (
                <div className="divide-y divide-line border-t border-line">
                  {shown.map((k) => (
                    <div key={k} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="whitespace-pre-wrap break-words text-xs leading-snug text-muted">{k}</div>
                        {isChanged(k) && (
                          <button
                            onClick={() => reset(k)}
                            className="shrink-0 text-xs font-semibold text-sub hover:text-ink"
                          >
                            reset
                          </button>
                        )}
                      </div>
                      <textarea
                        value={valueOf(k)}
                        onChange={(e) => setField(k, e.target.value)}
                        rows={k.length > 90 ? 3 : 1}
                        spellCheck={false}
                        className={`mt-1.5 w-full resize-y rounded-lg border bg-sand px-3 py-2 text-sm outline-none focus:border-ink ${
                          isChanged(k) ? "border-olive" : "border-line"
                        }`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
