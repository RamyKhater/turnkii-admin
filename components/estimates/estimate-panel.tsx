"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestEstimate, signOffEstimate } from "@/lib/estimate/actions";

export type EstimateView = {
  id: number; ref: string; status: string;
  autoQuotation: number | null; confirmedQuotation: number | null;
  slaDueAt: string | null; customerUrl: string | null;
} | null;

const egp = (n: number | null) => (n == null ? "—" : "EGP " + Math.round(n).toLocaleString("en-US"));
const STATUS: Record<string, string> = {
  requested: "Requested · with FLPP", drafting: "Being priced by FLPP",
  confirmed: "Confirmed · ready to sign off", published: "Published to client", declined: "Declined",
};

export function EstimatePanel({ requestId, estimate, canRequest, canSignoff }: {
  requestId: number; estimate: EstimateView; canRequest: boolean; canSignoff: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const router = useRouter();

  if (!estimate) {
    if (!canRequest) return null;
    return (
      <div className="rounded-2xl border border-line bg-paper p-5">
        <h2 className="text-sm font-bold">Costed estimate</h2>
        <p className="mt-1 text-xs text-sub">Auto-cost this brief, send it to FLPP to price against real rates, then publish the confirmed estimate + payment options to the client — within 24h.</p>
        {err && <p className="mt-2 text-xs text-crit">{err}</p>}
        <button
          onClick={() => start(async () => { setErr(""); const r = await requestEstimate(requestId); if (r.error) setErr(r.error); else router.refresh(); })}
          disabled={pending}
          className="mt-3 rounded-full bg-ink px-4 py-2 text-sm font-bold text-cream hover:bg-lime hover:text-ink disabled:opacity-60"
        >Request a costed estimate</button>
      </div>
    );
  }

  const due = estimate.slaDueAt ? new Date(estimate.slaDueAt) : null;
  const overdue = due ? due.getTime() < Date.now() && estimate.status !== "published" : false;
  return (
    <div className="rounded-2xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Costed estimate · {estimate.ref}</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${estimate.status === "published" ? "bg-ok/15 text-ok" : estimate.status === "confirmed" ? "bg-lime text-ink" : "bg-sand text-muted"}`}>
          {STATUS[estimate.status] ?? estimate.status}
        </span>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div><dt className="text-xs uppercase tracking-wide text-muted">Auto-cost</dt><dd className="font-semibold tabular">{egp(estimate.autoQuotation)}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-muted">Confirmed</dt><dd className="font-semibold tabular">{egp(estimate.confirmedQuotation)}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-muted">Due</dt><dd className={`font-semibold tabular ${overdue ? "text-crit" : ""}`}>{due ? due.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}{overdue ? " · overdue" : ""}</dd></div>
      </dl>
      {err && <p className="mt-2 text-xs text-crit">{err}</p>}
      {estimate.status === "confirmed" && canSignoff && (
        <button
          onClick={() => start(async () => { setErr(""); const r = await signOffEstimate(estimate.id); if (r.error) setErr(r.error); else router.refresh(); })}
          disabled={pending}
          className="mt-3 rounded-full bg-ink px-4 py-2 text-sm font-bold text-cream hover:bg-lime hover:text-ink disabled:opacity-60"
        >Sign off &amp; publish to client</button>
      )}
      {estimate.status === "published" && estimate.customerUrl && (
        <a href={estimate.customerUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-olive hover:text-ink">View the client's estimate →</a>
      )}
    </div>
  );
}
