"use client";
import { useState, useTransition } from "react";
import { fmtEGP } from "@/lib/payments";
import { resolveMedia, unshareMedia, voidSignoff, aiRejectionTasks } from "@/lib/projects/actions";

export type TLMedia = {
  id: number; type: string; url: string; caption: string | null; status: string;
  reason: string | null; comment: string | null; aiCaption: string | null;
  aiFlags: { severity: string; issues: string[]; ok: boolean } | null;
};
export type TLSignoff = {
  id: number; ref: string; signedByName: string; signedByRole: string;
  signedAtISO: string; voidedAtISO: string | null; itemCount: number; method: string; amount: number;
} | null;
export type TLUpdate = {
  id: number; stage: string | null; milestone: string | null; body: string | null;
  amount: number; sentAtISO: string | null; media: TLMedia[]; signoff: TLSignoff;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Awaiting client", cls: "bg-lime text-ink" },
  accepted: { label: "Accepted", cls: "bg-ok/15 text-ok" },
  rejected: { label: "Rejected", cls: "bg-crit/12 text-crit" },
  reshoot: { label: "Re-shoot asked", cls: "bg-warn/18 text-warn" },
};
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");

function MediaCard({ m, projectId, manage }: { m: TLMedia; projectId: number; manage: boolean }) {
  const [pending, start] = useTransition();
  const [tasks, setTasks] = useState<string[] | null>(null);
  const st = STATUS[m.status] ?? STATUS.pending;
  const needs = m.status === "rejected" || m.status === "reshoot";
  const flagged = m.aiFlags && (!m.aiFlags.ok || m.aiFlags.issues.length > 0);

  return (
    <div className={`overflow-hidden rounded-xl border bg-white ${needs ? "border-crit/50" : "border-line"}`}>
      <div className="relative aspect-[4/3] bg-sand" style={{ backgroundImage: `url(${m.url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${st.cls}`}>{st.label}</span>
        {m.type === "video" && <span className="absolute bottom-2 right-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] font-bold text-cream">Video</span>}
        {flagged && <span className="absolute right-2 top-2 rounded-full bg-warn px-2 py-1 text-[10px] font-bold text-ink" title={m.aiFlags!.issues.join("; ")}>⚠ AI: {m.aiFlags!.severity}</span>}
      </div>
      <div className="p-3">
        <div className="text-sm font-semibold leading-snug">{m.caption || m.aiCaption || "Untitled"}</div>
        {flagged && <div className="mt-1 text-xs text-warn">{m.aiFlags!.issues.join(" · ")}</div>}
        {needs && <div className="mt-1.5 text-xs text-crit">{m.reason}{m.comment ? ` · “${m.comment}”` : ""}</div>}
        {m.status === "accepted" && <div className="mt-1 text-xs text-muted">Client accepted.</div>}
        {m.status === "pending" && <div className="mt-1 text-xs text-muted">No answer yet.</div>}

        {tasks && tasks.length > 0 && (
          <ul className="mt-2 space-y-1 rounded-lg bg-paper p-2.5 text-xs">
            {tasks.map((t, i) => <li key={i} className="flex gap-1.5"><span className="text-olive">→</span>{t}</li>)}
          </ul>
        )}

        {manage && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {needs && (
              <button onClick={() => start(async () => { await resolveMedia(m.id, projectId); })} disabled={pending}
                className="rounded-full bg-lime px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-60">
                {m.status === "reshoot" ? "Mark re-shot" : "Mark redone"}
              </button>
            )}
            {needs && (
              <button onClick={() => start(async () => { const r = await aiRejectionTasks(m.id); setTasks(r.tasks); })} disabled={pending}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-olive hover:border-ink disabled:opacity-60">
                ✨ Crew tasks
              </button>
            )}
            <button onClick={() => start(async () => { await unshareMedia(m.id, projectId); })} disabled={pending}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-crit hover:border-crit disabled:opacity-60">
              Unshare
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SignoffBar({ u, projectId, manage }: { u: TLUpdate; projectId: number; manage: boolean }) {
  const [pending, start] = useTransition();
  const signed = u.signoff && !u.signoff.voidedAtISO;
  const accepted = u.media.filter((m) => m.status === "accepted").length;
  const allAccepted = u.media.length > 0 && accepted === u.media.length;
  const money = fmtEGP(u.amount || 0);

  return (
    <div className={`flex flex-wrap items-start gap-4 border-t border-line px-5 py-4 ${signed ? "bg-ink text-cream" : allAccepted ? "bg-lime/10" : "bg-paper"}`}>
      <div className="min-w-[240px] flex-1">
        <div className={`text-[11px] font-bold uppercase tracking-[0.12em] ${signed ? "text-lime" : "text-olive"}`}>
          {signed ? `Client signed · ${u.signoff!.ref}` : allAccepted ? "Awaiting client sign-off" : "Sign-off blocked"}
        </div>
        <div className="mt-1.5 text-sm font-bold">{u.milestone || u.stage}</div>
        <div className={`mt-1 text-xs leading-relaxed ${signed ? "text-cream/70" : "text-sub"}`}>
          {signed
            ? `${u.signoff!.signedByName} (${u.signoff!.signedByRole}) · ${fmtDate(u.signoff!.signedAtISO)} · ${u.signoff!.itemCount} item(s) · ${u.signoff!.method}. Attach to the invoice for ${money}.`
            : allAccepted
              ? `All items accepted — the client can sign. ${money} releases on their signature.`
              : `${accepted} of ${u.media.length} accepted. Clear the rejected and re-shoot items first.`}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-2 text-xs font-bold ${signed ? "bg-lime text-ink" : "bg-sand text-muted"}`}>
          {signed ? `Payment released · ${money}` : `Payment held · ${money}`}
        </span>
        {signed && manage && (
          <button onClick={() => start(async () => { await voidSignoff(u.signoff!.id, projectId); })} disabled={pending}
            className="rounded-full border border-cream/30 px-3 py-2 text-xs font-bold text-cream/80 hover:bg-cream/10 disabled:opacity-60">
            Void certificate
          </button>
        )}
      </div>
    </div>
  );
}

export function ProgressTimeline({ projectId, updates, manage }: { projectId: number; updates: TLUpdate[]; manage: boolean }) {
  if (!updates.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-paper p-8 text-center">
        <div className="font-bold">Nothing shared on this project yet</div>
        <div className="mt-1 text-sm text-muted">Send the first update above.</div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {updates.map((u) => (
        <div key={u.id} className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex flex-wrap items-baseline gap-3 border-b border-line px-5 py-4">
            <div className="min-w-[220px] flex-1">
              <div className="text-base font-bold">{u.stage}</div>
              {u.body && <div className="mt-1 text-sm leading-relaxed text-sub">{u.body}</div>}
            </div>
            <div className="text-xs font-semibold text-muted">{fmtDate(u.sentAtISO)}</div>
          </div>
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
            {u.media.map((m) => <MediaCard key={m.id} m={m} projectId={projectId} manage={manage} />)}
          </div>
          <SignoffBar u={u} projectId={projectId} manage={manage} />
        </div>
      ))}
    </div>
  );
}
