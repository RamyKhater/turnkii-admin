"use client";
import { useOptimistic, useTransition } from "react";
import { setArabicEnabled } from "@/lib/settings/actions";

export function ArabicToggle({ enabled }: { enabled: boolean }) {
  const [on, setOptimistic] = useOptimistic(enabled);
  const [, start] = useTransition();
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label="Arabic site"
      onClick={() =>
        start(async () => {
          setOptimistic(!on);
          await setArabicEnabled(!on);
        })
      }
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-ok" : "bg-line"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
