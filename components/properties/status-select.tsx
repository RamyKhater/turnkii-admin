"use client";
import { useTransition } from "react";
import { setPropertyStatus } from "@/lib/properties/actions";

const STATUSES = ["active", "in_progress", "handed_over", "on_hold"];
const LABEL: Record<string, string> = {
  active: "Active", in_progress: "In progress", handed_over: "Handed over", on_hold: "On hold",
};

export function PropertyStatusSelect({ id, status, disabled }: { id: number; status: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={status}
      disabled={disabled || pending}
      onChange={(e) => start(() => setPropertyStatus(id, e.target.value))}
      className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm font-semibold outline-none focus:border-ink disabled:opacity-50"
    >
      {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
    </select>
  );
}

export const PROPERTY_STATUS_LABEL = LABEL;
