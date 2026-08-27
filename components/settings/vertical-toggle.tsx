"use client";
import { useOptimistic, useTransition } from "react";
import { setVertical } from "@/lib/settings/actions";

export function VerticalToggle({ settingKey, enabled }: { settingKey: string; enabled: boolean }) {
  // Optimistic so the switch moves the instant it's tapped; the server (and the
  // background site rebuild) catch up without blocking the UI.
  const [shown, setOptimistic] = useOptimistic(enabled);
  const [, start] = useTransition();
  return (
    <button
      role="switch"
      aria-checked={shown}
      onClick={() =>
        start(async () => {
          setOptimistic(!shown);
          await setVertical(settingKey, !shown);
        })
      }
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${shown ? "bg-ok" : "bg-line"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${shown ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
