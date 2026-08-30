import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { sendEmail, layout, button, esc, appUrl } from "./send";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  product_manager: "Product manager",
  ops_manager: "Operations manager",
  agent: "Agent",
  content_editor: "Content editor",
};

type NewUser = { name: string; email: string; role: string };

/** Welcome email for a newly created staff account. We never email a password —
 *  the admin who created the account shares it (or resets it). */
export function accountWelcomeEmail(user: NewUser): { subject: string; html: string } {
  const first = (user.name ?? "").split(" ")[0] || "there";
  const roleLabel = ROLE_LABEL[user.role] ?? user.role;
  const loginUrl = `${appUrl()}/login`;
  const html = layout({
    heading: `Welcome to Turnkii, ${esc(first)}.`,
    intro: `An account has been created for you on the Turnkii admin as <b>${esc(roleLabel)}</b>.`,
    preheader: "Your Turnkii admin account is ready.",
    body:
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Sign in with your email <b>${esc(user.email)}</b>. The teammate who set up your account will share your password — you can change it once you're in.</p>` +
      button("Open the admin", loginUrl),
    footnote: "You're receiving this because an admin created an account for you.",
  });
  return { subject: "Your Turnkii admin account is ready", html };
}

/** Send the welcome email, unless the notify.accountWelcome toggle is off.
 *  Safe to call inside after(). */
export async function sendAccountWelcome(user: NewUser): Promise<void> {
  const db = await getDb();
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, "notify.accountWelcome")).limit(1);
  const enabled = row ? row.enabled : true; // default on
  if (!enabled) return;
  const { subject, html } = accountWelcomeEmail(user);
  await sendEmail({ to: user.email, subject, html });
}
