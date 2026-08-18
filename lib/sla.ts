import type { Request } from "@/lib/db/schema";

// Defaults; overridable via site_settings (group "sla").
export const SLA_DEFAULTS = {
  firstResponseHours: 24, // call back within 1 working day
  resolveDays: 21, // brief → won/lost target
};

export type SlaState = "met" | "on_track" | "at_risk" | "breached" | "n/a";

const hours = (ms: number) => ms / 3_600_000;

/** First-response SLA: time from creation to first contact (status left "new"). */
export function firstResponseSla(
  r: Pick<Request, "createdAt" | "firstResponseAt" | "status">,
  targetHours = SLA_DEFAULTS.firstResponseHours,
): { state: SlaState; label: string } {
  if (r.firstResponseAt) {
    const took = hours(r.firstResponseAt.getTime() - r.createdAt.getTime());
    return { state: took <= targetHours ? "met" : "breached", label: `${took.toFixed(0)}h to first contact` };
  }
  const age = hours(Date.now() - r.createdAt.getTime());
  if (age > targetHours) return { state: "breached", label: `${age.toFixed(0)}h, no contact` };
  if (age > targetHours * 0.75) return { state: "at_risk", label: `${(targetHours - age).toFixed(0)}h left` };
  return { state: "on_track", label: `${(targetHours - age).toFixed(0)}h left` };
}

/** Resolution SLA: creation → won/lost. */
export function resolutionSla(
  r: Pick<Request, "createdAt" | "resolvedAt" | "status">,
  targetDays = SLA_DEFAULTS.resolveDays,
): { state: SlaState; label: string; days: number | null } {
  if (r.resolvedAt) {
    const days = (r.resolvedAt.getTime() - r.createdAt.getTime()) / 86_400_000;
    return { state: days <= targetDays ? "met" : "breached", label: `${days.toFixed(1)}d to resolve`, days };
  }
  const ageDays = (Date.now() - r.createdAt.getTime()) / 86_400_000;
  if (ageDays > targetDays) return { state: "breached", label: `open ${ageDays.toFixed(0)}d`, days: null };
  if (ageDays > targetDays * 0.75) return { state: "at_risk", label: `open ${ageDays.toFixed(0)}d`, days: null };
  return { state: "on_track", label: `open ${ageDays.toFixed(0)}d`, days: null };
}

export const SLA_STYLE: Record<SlaState, { chip: string; dot: string; label: string }> = {
  met: { chip: "bg-ok/12 text-ok", dot: "bg-ok", label: "Met" },
  on_track: { chip: "bg-info/10 text-info", dot: "bg-info", label: "On track" },
  at_risk: { chip: "bg-warn/15 text-warn", dot: "bg-warn", label: "At risk" },
  breached: { chip: "bg-crit/10 text-crit", dot: "bg-crit", label: "Breached" },
  "n/a": { chip: "bg-sand text-muted", dot: "bg-muted", label: "—" },
};
