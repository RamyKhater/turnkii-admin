import "server-only";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { SLA_DEFAULTS } from "@/lib/sla";

export async function getSettings() {
  const db = await getDb();
  return db.select().from(siteSettings);
}

/** Public site config: which verticals are on, and SLA targets. */
export async function getSiteConfig() {
  const rows = await getSettings();
  const verticals: Record<string, boolean> = {};
  for (const r of rows) {
    if (r.group === "vertical") verticals[r.key.replace("vertical.", "")] = r.enabled;
  }
  const firstResponseHours = Number(rows.find((r) => r.key === "sla.firstResponseHours")?.value ?? SLA_DEFAULTS.firstResponseHours);
  const resolveDays = Number(rows.find((r) => r.key === "sla.resolveDays")?.value ?? SLA_DEFAULTS.resolveDays);
  return { verticals, sla: { firstResponseHours, resolveDays } };
}
