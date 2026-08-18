"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";

export async function setVertical(key: string, enabled: boolean) {
  const user = await assertCap("settings:manage");
  const db = await getDb();
  await db.update(siteSettings).set({ enabled, updatedAt: new Date() }).where(eq(siteSettings.key, key));
  await logActivity(user.id, "settings.vertical", "setting", key, { enabled });
  revalidatePath("/settings");
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
