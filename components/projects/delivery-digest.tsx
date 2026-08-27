"use client";
import { useState, useTransition } from "react";
import { aiDeliveryDigest } from "@/lib/projects/actions";

export function DeliveryDigest() {
  const [pending, start] = useTransition();
  const [text, setText] = useState<string>("");
  const [ran, setRan] = useState(false);

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Delivery risk</h2>
          <p className="text-xs text-sub">A prioritised read on which projects need attention — quiet updates, blocked items, milestones to sign, overdue money.</p>
        </div>
        <button onClick={() => { setRan(true); start(async () => { const r = await aiDeliveryDigest(); setText(r.text); }); }} disabled={pending}
          className="shrink-0 rounded-full border border-line px-4 py-2 text-sm font-bold text-olive hover:border-ink disabled:opacity-60">
          {pending ? "Assessing…" : "✨ Generate digest"}
        </button>
      </div>
      {ran && !pending && (
        text
          ? <div className="mt-4 whitespace-pre-line rounded-xl bg-paper p-4 text-sm leading-relaxed text-ink">{text}</div>
          : <p className="mt-4 text-xs text-muted">AI is not configured (set ANTHROPIC_API_KEY), or there is nothing to flag.</p>
      )}
    </div>
  );
}
