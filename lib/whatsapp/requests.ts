import "server-only";
import { getDb } from "@/lib/db";
import { siteSettings, requests } from "@/lib/db/schema";
import { sendWhatsAppTemplate } from "./send";

type RequestRow = typeof requests.$inferSelect;

// Defaults for the WhatsApp template config. Admins can override the template
// names / language / recipients in Settings → WhatsApp notifications. The PARAM
// ORDER below is fixed and must match the approved template bodies (documented
// in the settings card):
//   customer template  {{1}} = first name, {{2}} = reference
//   team template      {{1}} = type label, {{2}} = reference, {{3}} = name · phone
export const WA_DEFAULTS = {
  customerTemplate: "request_received",
  teamTemplate: "new_lead_alert",
  visitTemplate: "visit_confirmed",
  projectTemplate: "project_update",
  language: "en",
};

const KIND_LABEL: Record<string, string> = {
  brief: "website request",
  financing: "financing pre-approval",
  service: "service request",
  project: "project enquiry",
};

const isOn = (rows: { key: string; enabled: boolean }[], key: string, dflt: boolean) => {
  const r = rows.find((x) => x.key === key);
  return r ? r.enabled : dflt;
};
const val = (rows: { key: string; value: unknown }[], key: string, dflt: string) => {
  const v = rows.find((x) => x.key === key)?.value;
  const s = typeof v === "string" ? v.trim() : "";
  return s || dflt;
};

/** Send WhatsApp template messages for a new request: an optional confirmation
 *  to the submitter and an optional alert to configured team numbers. Both are
 *  off by default (they need approved templates). Safe to call inside after(). */
export async function dispatchRequestWhatsApp(req: RequestRow): Promise<void> {
  const db = await getDb();
  const settings = await db.select().from(siteSettings);
  const lang = val(settings, "notify.waLanguage", WA_DEFAULTS.language);
  const first = (req.contactName ?? "").split(" ")[0] || "there";
  const kindLabel = KIND_LABEL[req.kind ?? "brief"] ?? "request";

  // 1) confirmation to the submitter
  if (req.phone && isOn(settings, "notify.waCustomer", false)) {
    const tmpl = val(settings, "notify.waCustomerTemplate", WA_DEFAULTS.customerTemplate);
    await sendWhatsAppTemplate(req.phone, tmpl, lang, [first, req.ref]);
  }

  // 2) alert to the team numbers
  if (isOn(settings, "notify.waTeam", false)) {
    const recipients = String(settings.find((s) => s.key === "notify.waRecipients")?.value ?? "")
      .split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    if (recipients.length) {
      const tmpl = val(settings, "notify.waTeamTemplate", WA_DEFAULTS.teamTemplate);
      const who = [req.contactName, req.phone].filter(Boolean).join(" · ");
      for (const to of recipients) {
        await sendWhatsAppTemplate(to, tmpl, lang, [kindLabel, req.ref, who]);
      }
    }
  }
}

/** Format a stored visit day/slot into a friendly, human string. */
function visitWhen(req: RequestRow): string {
  let day = "";
  if (req.visitDay) {
    const d = new Date(req.visitDay);
    day = isNaN(d.getTime())
      ? req.visitDay
      : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }
  return [day, req.visitSlot ?? ""].filter(Boolean).join(" · ") || "the agreed time";
}

/** Confirm a booked site visit / online meeting to the customer over WhatsApp.
 *  Fired when the request is moved to "survey booked". Off by default. */
export async function dispatchVisitConfirmation(req: RequestRow): Promise<void> {
  if (!req.phone) return;
  const db = await getDb();
  const settings = await db.select().from(siteSettings);
  if (!isOn(settings, "notify.waVisit", false)) return;
  const lang = val(settings, "notify.waLanguage", WA_DEFAULTS.language);
  const tmpl = val(settings, "notify.waVisitTemplate", WA_DEFAULTS.visitTemplate);
  const first = (req.contactName ?? "").split(" ")[0] || "there";
  const typeLabel = req.visitType === "online" ? "online meeting" : "on-site survey";
  //   {{1}} first name, {{2}} reference, {{3}} date · slot, {{4}} visit type
  await sendWhatsAppTemplate(req.phone, tmpl, lang, [first, req.ref, visitWhen(req), typeLabel]);
}
