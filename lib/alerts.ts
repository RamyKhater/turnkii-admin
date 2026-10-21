import "server-only";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sendEmail, emailEnabled, layout, facts, button, appUrl } from "@/lib/email/send";

/**
 * Who gets operational alerts: every active admin / ops_manager, plus any
 * addresses in TK_ALERT_EMAIL (comma-separated) as a safety net in case no such
 * user has a reachable mailbox. De-duplicated. Best-effort — never throws.
 */
export async function opsEmails(): Promise<string[]> {
  const envList = (process.env.TK_ALERT_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const db = await getDb();
    const rows = await db.select({ email: users.email, role: users.role, active: users.active }).from(users);
    const team = rows.filter((u) => u.active && (u.role === "admin" || u.role === "ops_manager")).map((u) => u.email);
    return Array.from(new Set([...team, ...envList]));
  } catch {
    return envList;
  }
}

export type OpsAlert = {
  subject: string;
  heading: string;
  intro?: string;
  rows?: [string, string][];
  href?: string;        // absolute, or a path resolved against the admin URL
  hrefLabel?: string;
};

/**
 * Email the ops/admin team about an operational problem. Degrades gracefully:
 * if email isn't configured or there are no recipients it simply no-ops (the
 * in-app notification is always raised separately). Never throws.
 */
export async function alertOps(a: OpsAlert): Promise<void> {
  try {
    if (!emailEnabled()) return;
    const to = await opsEmails();
    if (!to.length) return;
    const href = a.href ? (a.href.startsWith("http") ? a.href : `${appUrl()}${a.href}`) : null;
    const body = `${a.rows?.length ? facts(a.rows) : ""}${href ? button(a.hrefLabel || "Open admin", href) : ""}`;
    await sendEmail({ to, subject: a.subject, html: layout({ heading: a.heading, intro: a.intro, body, preheader: a.intro }) });
  } catch (e) {
    console.error("[alerts] alertOps failed", e);
  }
}
