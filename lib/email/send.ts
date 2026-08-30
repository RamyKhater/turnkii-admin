import "server-only";

// Email is optional and provider-agnostic over Resend's REST API (no SMTP, no
// extra dependency, serverless-friendly). Features degrade gracefully when the
// key/sender are not configured — the app still records in-app notifications.
//   RESEND_API_KEY  — Resend API key
//   TK_EMAIL_FROM   — verified sender, e.g. "Turnkii <hello@turnkii.app>"
//   TK_EMAIL_REPLY_TO (optional) — default reply-to
//   TK_ADMIN_URL (optional) — admin base URL for links in emails

export function emailEnabled(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.TK_EMAIL_FROM);
}

/** Base URL of the admin app, for links inside emails. */
export function appUrl(): string {
  const explicit = process.env.TK_ADMIN_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

export type EmailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type EmailResult = { ok: boolean; id?: string; skipped?: boolean; error?: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Send one email. Never throws — returns a result so callers (often inside
 *  after()) can log and move on without failing the request. */
export async function sendEmail(m: EmailMessage): Promise<EmailResult> {
  const to = (Array.isArray(m.to) ? m.to : [m.to]).map((s) => s.trim()).filter((s) => EMAIL_RE.test(s));
  if (!to.length) return { ok: false, skipped: true };
  if (!emailEnabled()) {
    console.warn(`[email] skipped (RESEND_API_KEY / TK_EMAIL_FROM not set): "${m.subject}" → ${to.join(", ")}`);
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.TK_EMAIL_FROM,
        to,
        subject: m.subject,
        html: m.html,
        text: m.text || htmlToText(m.html),
        reply_to: m.replyTo || process.env.TK_EMAIL_REPLY_TO || undefined,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] send failed ${res.status}: ${detail}`);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("[email] send error", e);
    return { ok: false, error: String(e) };
  }
}

// --- Brand-consistent HTML email shell -------------------------------------

const INK = "#12130E", CREAM = "#F6F3EC", LIME = "#D6F23C", SUB = "#5E5F52", LINE = "#E4E0D5";

// White wordmark on transparent — sits on a dark chip in the header. Override
// with TK_EMAIL_LOGO_URL if the logo moves. Falls back to the alt text when a
// client blocks images.
const LOGO_URL = process.env.TK_EMAIL_LOGO_URL || "https://turnkii.app/assets/turnkii-logo.png";

/** Wrap body content in the Turnkii email shell. All styles inlined for clients. */
export function layout(opts: { heading: string; intro?: string; body: string; preheader?: string; footnote?: string }): string {
  const { heading, intro, body, preheader, footnote } = opts;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:${CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="padding:4px 8px 16px;">
    <span style="display:inline-block;background:${INK};padding:13px 18px;border-radius:10px;line-height:0;">
      <img src="${LOGO_URL}" alt="Turnkii" height="22" style="height:22px;width:auto;display:block;border:0;" />
    </span>
  </td></tr>
  <tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
    <div style="padding:28px 28px 8px;">
      <h1 style="margin:0;font-size:22px;line-height:1.25;letter-spacing:-0.01em;">${esc(heading)}</h1>
      ${intro ? `<p style="margin:10px 0 0;font-size:15px;line-height:1.55;color:${SUB};">${intro}</p>` : ""}
    </div>
    <div style="padding:20px 28px 28px;">${body}</div>
  </td></tr>
  <tr><td style="padding:16px 12px;color:#8A8A79;font-size:12px;line-height:1.5;">
    ${footnote ? `${footnote}<br>` : ""}Turnkii — turnkey home finishing, furniture &amp; handover.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** A primary button (table-based for email clients). */
export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px;"><tr><td style="border-radius:999px;background:${INK};">
<a href="${esc(href)}" style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:700;color:${CREAM};text-decoration:none;border-radius:999px;">${esc(label)}</a>
</td></tr></table>`;
}

/** A definition list of label/value facts. */
export function facts(rows: [string, string][]): string {
  const cells = rows
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#8A8A79;width:40%;vertical-align:top;">${esc(k)}</td>
<td style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${INK};">${esc(v)}</td>
</tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cells}</table>`;
}

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}
