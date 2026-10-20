"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recoverSubmission, dismissSubmission } from "@/lib/requests/recovery";

export function RecoveryActions({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<"" | "recovered" | "dismissed">("");
  const [err, setErr] = useState("");
  const router = useRouter();

  if (done === "recovered") return <span className="text-sm font-bold text-ok">Recovered</span>;
  if (done === "dismissed") return <span className="text-sm text-muted">Dismissed</span>;

  return (
    <div className="flex items-center justify-end gap-2">
      {err && <span className="mr-1 text-xs text-crit">{err}</span>}
      <button
        onClick={() => start(async () => {
          setErr("");
          const r = await recoverSubmission(id);
          if (r.error) setErr(r.error); else { setDone("recovered"); router.refresh(); }
        })}
        disabled={pending}
        className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-cream hover:bg-lime hover:text-ink disabled:opacity-60"
      >Recover as request</button>
      <button
        onClick={() => start(async () => {
          setErr("");
          const r = await dismissSubmission(id);
          if (r.error) setErr(r.error); else { setDone("dismissed"); router.refresh(); }
        })}
        disabled={pending}
        className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-muted hover:border-ink disabled:opacity-60"
      >Dismiss</button>
    </div>
  );
}
