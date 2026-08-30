import "server-only";
import { getDb } from "@/lib/db";
import { users, siteSettings, requests } from "@/lib/db/schema";
import { sendEmail, layout, button, facts, esc, appUrl } from "./send";

type RequestRow = typeof requests.$inferSelect;

const egp = (v: number | null | undefined) => (v ? `EGP ${v.toLocaleString("en-US")}` : "");

// Editable subject/heading copy. Admins set these in Settings → Email
// notifications; missing keys fall back to these defaults. Tokens are filled
// per request. The one string is used for both the email subject and the
// in-email heading, so what's set is exactly what's sent.
export type EmailCopy = {
  teamBrief: string;
  teamFinancing: string;
  customerBrief: string;
  customerFinancing: string;
};

export const EMAIL_COPY_DEFAULTS: EmailCopy = {
  teamBrief: "New website request · {ref}",
  teamFinancing: "New financing pre-approval · {ref}",
  customerBrief: "Thanks {first} — your brief is in",
  customerFinancing: "We've received your pre-approval request, {first}",
};

export function mergeEmailCopy(over: Partial<EmailCopy> | null | undefined): EmailCopy {
  return { ...EMAIL_COPY_DEFAULTS, ...(over ?? {}) };
}

/** Fill {ref} {first} {name} {location} {limit} {plan} in a copy string. */
export function fillTokens(s: string, req: RequestRow): string {
  const first = (req.contactName ?? "").split(" ")[0] || "there";
  return String(s ?? "")
    .replaceAll("{ref}", req.ref)
    .replaceAll("{first}", first)
    .replaceAll("{name}", req.contactName ?? "")
    .replaceAll("{location}", req.location ?? "")
    .replaceAll("{limit}", egp(req.indicativeLimit))
    .replaceAll("{plan}", req.budgetPlan ?? "")
    .replace(/\s{2,}/g, " ").trim();
}

/** Ops/admin alert for a new incoming request or pre-approval. */
export function adminRequestEmail(req: RequestRow, title: string): { subject: string; html: string } {
  const fin = req.kind === "financing";
  const rows: [string, string][] = [
    ["Contact", req.contactName ?? ""],
    ["Phone", req.phone ?? ""],
    ["Email", req.email ?? ""],
  ];
  if (fin) {
    rows.push(
      ["Indicative limit", egp(req.indicativeLimit)],
      ["Requested amount", egp(req.financeAmount)],
      ["Monthly income", egp(req.monthlyIncome)],
      ["Employment", req.employment ?? ""],
      ["Plan of interest", req.budgetPlan ?? ""],
    );
  } else {
    rows.push(
      ["Property", [req.propertyType, req.area ? `${req.area} m²` : "", req.units ? `${req.units} unit${req.units === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")],
      ["Location", req.location ?? ""],
      ["Style", req.style ?? ""],
      ["Services", (req.services ?? []).join(", ")],
      ["Financing", req.budgetPlan ?? ""],
    );
  }
  rows.push(["Traffic source", req.channel ?? ""]);
  if (req.message) rows.push(["Message", req.message]);

  const html = layout({
    heading: title,
    intro: `${esc(req.contactName ?? "Someone")} just submitted through the website. Respond within your SLA to keep the lead warm.`,
    preheader: `${req.contactName ?? ""} · ${fin ? egp(req.indicativeLimit) || "pre-approval" : req.location ?? ""}`,
    body: facts(rows) + button("Open in the admin", `${appUrl()}/requests/${req.id}`),
  });
  return { subject: title, html };
}

/** Confirmation to the person who submitted — the "user receiving" side. */
export function customerRequestEmail(req: RequestRow, title: string): { subject: string; html: string } {
  const fin = req.kind === "financing";
  let body: string;
  if (fin) {
    body =
      (req.indicativeLimit ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Based on the income you shared, your <b>indicative limit is ${esc(egp(req.indicativeLimit))}</b>. This is a soft estimate — it doesn't affect your credit file.</p>` : "") +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Our team confirms the final limit with our partner bank once your scope is priced, usually within one working day of your free site survey. We'll call you on <b>${esc(req.phone ?? "your mobile")}</b> to arrange it.</p>`;
  } else {
    body =
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">We've got your brief and a Turnkii coordinator will call you on <b>${esc(req.phone ?? "your mobile")}</b> within 24 hours to confirm your free site survey.</p>` +
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">A surveyor and a designer attend for about 45 minutes, and a written scope with an EGP range follows within three working days.</p>`;
  }
  const html = layout({
    heading: title,
    body:
      body +
      `<p style="margin:14px 0 0;font-size:13px;color:#8A8A79;line-height:1.5;">Your reference is <b>${esc(req.ref)}</b>. Just reply to this email if anything changes.</p>`,
    preheader: fin ? "Your indicative financing limit and next steps." : "We'll call within 24 hours to book your survey.",
    footnote: `Reference ${esc(req.ref)}`,
  });
  return { subject: title, html };
}

const isOn = (rows: { key: string; enabled: boolean }[], key: string, dflt: boolean) => {
  const r = rows.find((x) => x.key === key);
  return r ? r.enabled : dflt;
};

/**
 * Send the emails for a newly created request: an alert to ops/admin (and any
 * extra recipients), plus a confirmation to the submitter. Reads the notify.*
 * settings for toggles and extra recipients. Safe to call inside after().
 */
export async function dispatchRequestEmails(req: RequestRow): Promise<void> {
  const db = await getDb();
  const settings = await db.select().from(siteSettings);
  const fin = req.kind === "financing";
  const copy = mergeEmailCopy(settings.find((s) => s.key === "notify.emailCopy")?.value as Partial<EmailCopy> | undefined);

  // 1) ops/admin alert
  if (isOn(settings, "notify.newRequestEmail", true)) {
    const staff = await db.select({ email: users.email, role: users.role, active: users.active }).from(users);
    const staffEmails = staff.filter((u) => u.active && (u.role === "admin" || u.role === "ops_manager")).map((u) => u.email);
    const extra = String(settings.find((s) => s.key === "notify.extraRecipients")?.value ?? "")
      .split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    const to = Array.from(new Set([...staffEmails, ...extra]));
    if (to.length) {
      const title = fillTokens(fin ? copy.teamFinancing : copy.teamBrief, req);
      const { subject, html } = adminRequestEmail(req, title);
      await sendEmail({ to, subject, html, replyTo: req.email ?? undefined });
    }
  }

  // 2) confirmation to the submitter
  if (req.email && isOn(settings, "notify.customerReceipt", true)) {
    const title = fillTokens(fin ? copy.customerFinancing : copy.customerBrief, req);
    const { subject, html } = customerRequestEmail(req, title);
    await sendEmail({ to: req.email, subject, html });
  }
}
