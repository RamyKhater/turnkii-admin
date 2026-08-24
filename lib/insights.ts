import type { Request, Role } from "@/lib/db/schema";
import { ROLE_LABEL } from "@/lib/auth/rbac";

const HOURS = 3_600_000;
const DAYS = 86_400_000;

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function firstResponseHours(rows: Request[]): number {
  const v = rows.filter((r) => r.firstResponseAt).map((r) => (r.firstResponseAt!.getTime() - r.createdAt.getTime()) / HOURS);
  return avg(v);
}
function resolutionDays(rows: Request[]): number {
  const v = rows.filter((r) => r.resolvedAt).map((r) => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / DAYS);
  return avg(v);
}

export type SourceRow = {
  channel: string; requests: number; won: number; lost: number;
  wonRate: number; avgFirstResponseH: number; avgResolveDays: number;
};

/** Traffic-source (channel) breakdown with KPIs applied per source. */
export function sourceInsights(rows: Request[]): SourceRow[] {
  const channels = Array.from(new Set(rows.map((r) => r.channel || "Direct")));
  return channels
    .map((channel) => {
      const g = rows.filter((r) => (r.channel || "Direct") === channel);
      const won = g.filter((r) => r.status === "won").length;
      const lost = g.filter((r) => r.status === "lost").length;
      return {
        channel,
        requests: g.length,
        won,
        lost,
        wonRate: won + lost ? Math.round((won / (won + lost)) * 100) : 0,
        avgFirstResponseH: firstResponseHours(g),
        avgResolveDays: resolutionDays(g),
      };
    })
    .sort((a, b) => b.requests - a.requests);
}

export type CampaignRow = { campaign: string; source: string; requests: number; won: number; wonRate: number };

/** UTM campaign breakdown — only requests that arrived tagged with a campaign. */
export function campaignInsights(rows: Request[]): CampaignRow[] {
  const tagged = rows.filter((r) => r.utmCampaign);
  const keys = Array.from(new Set(tagged.map((r) => `${r.utmCampaign}||${r.utmSource ?? ""}`)));
  return keys
    .map((k) => {
      const [campaign, source] = k.split("||");
      const g = tagged.filter((r) => (r.utmCampaign ?? "") === campaign && (r.utmSource ?? "") === source);
      const won = g.filter((r) => r.status === "won").length;
      const lost = g.filter((r) => r.status === "lost").length;
      return { campaign, source: source || "—", requests: g.length, won, wonRate: won + lost ? Math.round((won / (won + lost)) * 100) : 0 };
    })
    .sort((a, b) => b.requests - a.requests);
}

export type ServiceRow = { service: string; requests: number; won: number; wonRate: number };

/** Requests per service type. */
export function serviceInsights(rows: Request[], serviceNames: string[]): ServiceRow[] {
  return serviceNames
    .map((service) => {
      const g = rows.filter((r) => (r.services ?? []).includes(service));
      const won = g.filter((r) => r.status === "won").length;
      const lost = g.filter((r) => r.status === "lost").length;
      return { service, requests: g.length, won, wonRate: won + lost ? Math.round((won / (won + lost)) * 100) : 0 };
    })
    .filter((s) => s.requests > 0)
    .sort((a, b) => b.requests - a.requests);
}

export type UserRow = {
  name: string; role: Role; roleLabel: string; active: boolean;
  assignedOpen: number; won: number; lost: number; wonRate: number; avgResolveDays: number;
};

/** Per-user (team) insights derived from the requests they own. */
export function userInsights(
  rows: Request[],
  users: { id: number; name: string; role: Role; active: boolean }[],
): UserRow[] {
  return users
    .filter((u) => u.role === "agent" || u.role === "ops_manager")
    .map((u) => {
      const g = rows.filter((r) => r.assignedTo === u.id);
      const won = g.filter((r) => r.status === "won").length;
      const lost = g.filter((r) => r.status === "lost").length;
      const open = g.filter((r) => r.status !== "won" && r.status !== "lost").length;
      return {
        name: u.name, role: u.role, roleLabel: ROLE_LABEL[u.role], active: u.active,
        assignedOpen: open, won, lost,
        wonRate: won + lost ? Math.round((won / (won + lost)) * 100) : 0,
        avgResolveDays: resolutionDays(g),
      };
    })
    .sort((a, b) => b.won - a.won || b.assignedOpen - a.assignedOpen);
}

/** Serialize rows to CSV (Excel-compatible; opens directly in Excel). */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  return "﻿" + lines.join("\r\n"); // BOM so Excel reads UTF-8
}
