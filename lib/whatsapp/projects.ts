import "server-only";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { sendWhatsAppTemplate } from "./send";
import { WA_DEFAULTS } from "./requests";

type ProjectLike = { name: string; ownerName: string | null; ownerPhone: string | null };

/** Notify the project owner over WhatsApp that a new progress update was shared.
 *  Off by default (needs an approved template). Safe to call best-effort. */
export async function dispatchProjectUpdateWhatsApp(proj: ProjectLike, stage: string): Promise<void> {
  if (!proj.ownerPhone) return;
  const db = await getDb();
  const settings = await db.select().from(siteSettings);
  const on = settings.find((s) => s.key === "notify.waProject")?.enabled ?? false;
  if (!on) return;
  const get = (k: string, dflt: string) => {
    const v = settings.find((s) => s.key === k)?.value;
    return (typeof v === "string" ? v.trim() : "") || dflt;
  };
  const lang = get("notify.waLanguage", WA_DEFAULTS.language);
  const tmpl = get("notify.waProjectTemplate", WA_DEFAULTS.projectTemplate);
  const first = (proj.ownerName ?? "").split(" ")[0] || "there";
  //   {{1}} owner first name, {{2}} project name, {{3}} update stage
  await sendWhatsAppTemplate(proj.ownerPhone, tmpl, lang, [first, proj.name, stage || "a new update"]);
}
