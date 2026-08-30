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
  language: "en",
};

const KIND_LABEL: Record<string, string> = {
  brief: "website request",
  financing: "financing pre-approval",
  service: "service request",
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
