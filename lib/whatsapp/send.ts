import "server-only";

// WhatsApp Business messaging over Meta's Cloud API (no SMTP, no extra deps).
// Optional and graceful: when the credentials are absent, sends are skipped and
// logged, exactly like the email layer. Business-initiated messages must use a
// Meta-APPROVED template, so we send template messages with ordered params.
//   WHATSAPP_TOKEN            — permanent access token for the WABA
//   WHATSAPP_PHONE_NUMBER_ID  — the sending phone number's ID
//   WHATSAPP_API_VERSION      — Graph API version (default v21.0)

export function whatsappEnabled(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

/** Normalise a phone to Cloud-API digits (country code, no +, no punctuation).
 *  Egyptian defaults: a leading 0 becomes the 20 country code. */
export function toWaNumber(raw: string | null | undefined, defaultCc = "20"): string {
  let d = String(raw ?? "").trim().replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = defaultCc + d.slice(1);
  return d.replace(/\D/g, "");
}

export type WaResult = { ok: boolean; id?: string; skipped?: boolean; error?: string };

/** Send an approved template message. Never throws — returns a result so callers
 *  (inside after()) can log and continue without failing the request. */
export async function sendWhatsAppTemplate(
  to: string,
  template: string,
  language: string,
  params: string[],
): Promise<WaResult> {
  const num = toWaNumber(to);
  if (!num || num.length < 8) return { ok: false, skipped: true };
  if (!whatsappEnabled()) {
    console.warn(`[whatsapp] skipped (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set): "${template}" → ${num}`);
    return { ok: false, skipped: true };
  }
  const url = `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: num,
    type: "template",
    template: {
      name: template,
      language: { code: language || "en" },
      ...(params.length
        ? { components: [{ type: "body", parameters: params.map((t) => ({ type: "text", text: String(t ?? "") })) }] }
        : {}),
    },
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[whatsapp] send failed ${res.status}: ${detail}`);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[] };
    return { ok: true, id: data.messages?.[0]?.id };
  } catch (e) {
    console.error("[whatsapp] send error", e);
    return { ok: false, error: String(e) };
  }
}
