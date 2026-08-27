"use client";
import { useActionState, useState, useTransition } from "react";
import { sendProgressUpdate, aiDraftNote, type UpdateState } from "@/lib/projects/actions";

export type LibraryItem = { url: string; label: string; type?: "photo" | "video" };
type Picked = LibraryItem & { caption: string };

const lbl = "text-xs font-bold uppercase tracking-wider text-muted";
const input = "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink";

export function SendUpdateForm({ projectId, library }: { projectId: number; library: LibraryItem[] }) {
  const [state, action, pending] = useActionState<UpdateState, FormData>(sendProgressUpdate, {});
  const [picks, setPicks] = useState<Picked[]>([]);
  const [stage, setStage] = useState("");
  const [milestone, setMilestone] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [drafting, startDraft] = useTransition();

  const toggle = (it: LibraryItem) =>
    setPicks((p) => p.some((x) => x.url === it.url) ? p.filter((x) => x.url !== it.url) : [...p, { ...it, caption: it.label }]);
  const addUrl = () => {
    const u = url.trim();
    if (!u) return;
    const type: "photo" | "video" = /\.(mp4|mov|webm)$/i.test(u) ? "video" : "photo";
    setPicks((p) => [...p, { url: u, label: "Uploaded", caption: "", type }]);
    setUrl("");
  };
  const setCaption = (i: number, v: string) => setPicks((p) => p.map((x, idx) => idx === i ? { ...x, caption: v } : x));

  function draft() {
    startDraft(async () => {
      const r = await aiDraftNote({ stage, milestone, items: picks.map((p) => ({ caption: p.caption, type: p.type })) });
      if (r.note) setNote(r.note);
    });
  }

  const media = JSON.stringify(picks.map((p) => ({ type: p.type ?? "photo", url: p.url, caption: p.caption })));

  return (
    <form action={action} key={state.ok ? Date.now() : "f"} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="media" value={media} />
      {state.ok && <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm font-semibold text-ok">Sent — the client sees it in their account now.</p>}
      {state.error && <p className="rounded-lg bg-crit/10 px-3 py-2 text-sm font-semibold text-crit">{state.error}</p>}

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1.5" style={{ minWidth: 240 }}>
          <span className={lbl}>Stage title</span>
          <input name="stage" required value={stage} onChange={(e) => setStage(e.target.value)} placeholder="Week 6 · Kitchen install" className={input} />
        </label>
        <label className="flex flex-col gap-1.5" style={{ minWidth: 150 }}>
          <span className={lbl}>Payment released, EGP</span>
          <input name="amount" type="number" placeholder="412000" className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={lbl}>Milestone this signs off</span>
        <input name="milestone" value={milestone} onChange={(e) => setMilestone(e.target.value)} placeholder="Milestone 4 · Kitchen install" className={input} />
      </label>

      <div>
        <span className={lbl}>Media library — tap to attach</span>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {library.map((it) => {
            const on = picks.some((p) => p.url === it.url);
            return (
              <button type="button" key={it.url} onClick={() => toggle(it)}
                className={`overflow-hidden rounded-xl border text-left ${on ? "border-ink ring-2 ring-lime" : "border-line hover:border-ink"}`}>
                <span className="relative block aspect-[4/3] bg-sand" style={{ backgroundImage: `url(${it.url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
                  {on && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-lime text-[11px] font-bold text-ink">✓</span>}
                </span>
                <span className="block px-2.5 py-2 text-xs font-semibold">{it.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste an uploaded image/video URL" className={input} />
          <button type="button" onClick={addUrl} className="shrink-0 rounded-xl border border-line px-4 text-sm font-bold hover:border-ink">Add</button>
        </div>
      </div>

      {picks.length > 0 && (
        <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
          <span className={lbl}>{picks.length} attached · captions</span>
          {picks.map((p, i) => (
            <div key={p.url} className="flex items-center gap-2">
              <span className="h-8 w-8 shrink-0 rounded bg-sand" style={{ backgroundImage: `url(${p.url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
              <input value={p.caption} onChange={(e) => setCaption(i, e.target.value)} placeholder="Caption" className="flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-ink" />
              <button type="button" onClick={() => setPicks((pp) => pp.filter((_, idx) => idx !== i))} className="text-xs font-bold text-crit">Remove</button>
            </div>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between">
          <span className={lbl}>Note to the client</span>
          <button type="button" onClick={draft} disabled={drafting || (!picks.length && !stage)} className="text-xs font-bold text-olive hover:text-ink disabled:text-muted">
            {drafting ? "Drafting…" : "✨ Draft with AI"}
          </button>
        </span>
        <textarea name="body" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done this week, what happens next." className={input} />
      </label>

      <button type="submit" disabled={pending} className="rounded-full bg-lime px-6 py-3 text-sm font-bold text-ink hover:brightness-95 disabled:opacity-60">
        {pending ? "Sending…" : "Send to client →"}
      </button>
    </form>
  );
}
