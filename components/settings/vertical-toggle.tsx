"use client";
import { useTransition } from "react";
import { setVertical } from "@/lib/settings/actions";

export function VerticalToggle({ settingKey, enabled }: { settingKey: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      role="switch"
      aria-checked={enabled}
      disabled={pending}
      onClick={() => start(() => setVertical(settingKey, !enabled))}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-ok" : "bg-line"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
