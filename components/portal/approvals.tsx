"use client";
import { useState, useTransition } from "react";
import { ownerDecideMedia, ownerSignoff } from "@/lib/projects/approvals";

export type PMedia = { id: number; type: string; url: string; caption: string | null; status: string; reason: string | null };
export type PUpdate = {
  id: number; stage: string | null; milestone: string | null; body: string | null; amount: number;
  sentAtISO: string | null; projectName: string; media: PMedia[]; signed: boolean; signoffRef: string | null;
};

const REJECT = ["Not the agreed finish", "Workmanship not acceptable", "Wrong item or spec", "Damage visible", "Work not complete"];
const RESHOOT = ["Too dark", "Need a close-up", "Need the whole room", "Area behind not shown", "Photo is blurred"];
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Your decision", cls: "bg-lime text-ink" },
  accepted: { label: "Accepted", cls: "bg-ok/15 text-ok" },
  rejected: { label: "Rejected", cls: "bg-crit/12 text-crit" },
  reshoot: { label: "Re-shoot asked", cls: "bg-warn/18 text-warn" },
};

function decide(fd: FormData) { return ownerDecideMedia({}, fd); }

function Item({ m }: { m: PMedia }) {
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"" | "rejected" | "reshoot">("");
  const [comment, setComment] = useState("");
  const st = STATUS[m.status] ?? STATUS.pending;

  const send = (decision: string, reason?: string) => {
    const fd = new FormData();
    fd.set("mediaId", String(m.id)); fd.set("decision", decision);
    if (reason) fd.set("reason", reason);
    if (comment) fd.set("comment", comment);
    start(async () => { await decide(fd); setMode(""); setComment(""); });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="relative aspect-[4/3] bg-sand" style={{ backgroundImage: `url(${m.url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${st.cls}`}>{st.label}</span>
        {m.type === "video" && <span className="absolute bottom-2 right-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] font-bold text-cream">Video</span>}
      </div>
      <div className="p-3">
        <div className="text-sm font-semibold leading-snug">{m.caption || "Progress photo"}</div>
        {m.status !== "pending" && m.reason && <div className="mt-1 text-xs text-muted">{m.reason}</div>}

        {m.status === "pending" && mode === "" && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button onClick={() => send("accepted")} disabled={pending} className="rounded-full bg-ok px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60">Accept</button>
            <button onClick={() => setMode("reshoot")} className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-warn hover:border-warn">Ask re-shoot</button>
            <button onClick={() => setMode("rejected")} className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-crit hover:border-crit">Reject</button>
          </div>
        )}
        {mode !== "" && (
          <div className="mt-2.5 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {(mode === "rejected" ? REJECT : RESHOOT).map((r) => (
                <button key={r} onClick={() => send(mode, r)} disabled={pending} className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold hover:border-ink disabled:opacity-60">{r}</button>
              ))}
            </div>
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a note (optional)" className="w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-ink" />
            <button onClick={() => setMode("")} className="text-[11px] font-bold text-muted">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Approvals({ updates }: { updates: PUpdate[] }) {
  if (!updates.length) return <p className="text-sm text-muted">No progress shared yet.</p>;
  return (
    <div className="space-y-4">
      {updates.map((u) => <ApprovalCard key={u.id} u={u} />)}
    </div>
  );
}

function ApprovalCard({ u }: { u: PUpdate }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const accepted = u.media.filter((m) => m.status === "accepted").length;
  const allAccepted = u.media.length > 0 && accepted === u.media.length;
  const money = "EGP " + (u.amount || 0).toLocaleString("en-US");

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="flex flex-wrap items-baseline gap-3 border-b border-line px-5 py-4">
        <div className="min-w-[200px] flex-1">
          <div className="text-base font-bold">{u.stage}</div>
          <div className="text-xs text-muted">{u.projectName}{u.milestone ? ` · ${u.milestone}` : ""}</div>
          {u.body && <div className="mt-1.5 text-sm leading-relaxed text-sub">{u.body}</div>}
        </div>
        <div className="text-xs font-semibold text-muted">{u.sentAtISO ? new Date(u.sentAtISO).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}</div>
      </div>
      <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {u.media.map((m) => <Item key={m.id} m={m} />)}
      </div>
      <div className={`flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 ${u.signed ? "bg-ink text-cream" : allAccepted ? "bg-lime/10" : ""}`}>
        <div className="min-w-[220px] flex-1 text-sm">
          {u.signed
            ? <span className="font-semibold text-lime">Signed off · {u.signoffRef} · {money} released</span>
            : allAccepted
              ? <span className="font-semibold">All accepted — sign off to release {money} and book the visit.</span>
              : <span className="text-muted">{accepted} of {u.media.length} accepted. Review each item to continue.</span>}
          {err && <span className="ml-2 font-semibold text-crit">{err}</span>}
        </div>
        {!u.signed && (
          <button
            onClick={() => { setErr(""); start(async () => { const r = await ownerSignoff(u.id); if (r.error) setErr(r.error); }); }}
            disabled={!allAccepted || pending}
            className={`rounded-full px-5 py-2.5 text-sm font-bold ${allAccepted && !pending ? "bg-lime text-ink hover:brightness-95" : "bg-sand text-muted"}`}>
            {pending ? "Signing…" : "Sign off milestone"}
          </button>
        )}
      </div>
    </div>
  );
}
