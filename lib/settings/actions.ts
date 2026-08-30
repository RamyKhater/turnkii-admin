"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";
import { triggerSiteRebuild } from "@/lib/publish/trigger";
import { EMAIL_COPY_DEFAULTS } from "@/lib/email/requests";

export async function setVertical(key: string, enabled: boolean) {
  const user = await assertCap("settings:manage");
  const db = await getDb();
  await db.update(siteSettings).set({ enabled, updatedAt: new Date() }).where(eq(siteSettings.key, key));
  await logActivity(user.id, "settings.vertical", "setting", key, { enabled });
  revalidatePath("/settings");
  // Fire the (slow, network) site rebuild AFTER the response is sent so the
  // toggle returns immediately instead of waiting on the deploy hook.
  after(() => triggerSiteRebuild());
}

export async function updateSla(formData: FormData) {
  const user = await assertCap("settings:manage");
  const db = await getDb();
  const first = Math.max(1, Number(formData.get("firstResponseHours") ?? 24));
  const resolve = Math.max(1, Number(formData.get("resolveDays") ?? 21));
  await db.update(siteSettings).set({ value: first, updatedAt: new Date() }).where(eq(siteSettings.key, "sla.firstResponseHours"));
  await db.update(siteSettings).set({ value: resolve, updatedAt: new Date() }).where(eq(siteSettings.key, "sla.resolveDays"));
  await logActivity(user.id, "settings.sla", "setting", "sla", { first, resolve });
  revalidatePath("/settings");
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function updateNotifications(formData: FormData) {
  const user = await assertCap("settings:manage");
  const db = await getDb();
  const teamAlert = formData.get("newRequestEmail") != null;
  const customerReceipt = formData.get("customerReceipt") != null;
  const accountWelcome = formData.get("accountWelcome") != null;
  const extra = String(formData.get("extraRecipients") ?? "")
    .split(/[,;\s]+/).map((s) => s.trim()).filter((s) => EMAIL_RE.test(s));
  const now = new Date();
  // Upsert so the rows self-create on a DB that predates these settings.
  const put = (key: string, label: string, enabled: boolean, value: unknown = null) =>
    db.insert(siteSettings)
      .values({ key, label, group: "notify", enabled, value, updatedAt: now })
      .onConflictDoUpdate({ target: siteSettings.key, set: { enabled, value, updatedAt: now } });
  await put("notify.newRequestEmail", "Email the team on new requests", teamAlert);
  await put("notify.customerReceipt", "Send confirmation email to the submitter", customerReceipt);
  await put("notify.accountWelcome", "Welcome email on new staff accounts", accountWelcome);
  await put("notify.extraRecipients", "Extra alert recipients", true, extra.join(", "));

  // Editable subject/heading copy — fall back to defaults when a field is blank.
  const str = (k: string, dflt: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v || dflt;
  };
  const copy = {
    teamBrief: str("copyTeamBrief", EMAIL_COPY_DEFAULTS.teamBrief),
    teamFinancing: str("copyTeamFinancing", EMAIL_COPY_DEFAULTS.teamFinancing),
    teamService: str("copyTeamService", EMAIL_COPY_DEFAULTS.teamService),
    customerBrief: str("copyCustomerBrief", EMAIL_COPY_DEFAULTS.customerBrief),
    customerFinancing: str("copyCustomerFinancing", EMAIL_COPY_DEFAULTS.customerFinancing),
    customerService: str("copyCustomerService", EMAIL_COPY_DEFAULTS.customerService),
  };
  await put("notify.emailCopy", "Email subject/heading copy", true, copy);
  await logActivity(user.id, "settings.notifications", "setting", "notify", { teamAlert, customerReceipt, extra: extra.length });
  revalidatePath("/settings");
}
