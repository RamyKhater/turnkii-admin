"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { properties } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";

export async function createProperty(formData: FormData) {
  const user = await assertCap("properties:edit");
  const db = await getDb();
  const [row] = await db.insert(properties).values({
    name: String(formData.get("name") ?? "New property").trim() || "New property",
    ownerName: String(formData.get("ownerName") ?? "").trim() || null,
    ownerPhone: String(formData.get("ownerPhone") ?? "").trim() || null,
    ownerEmail: String(formData.get("ownerEmail") ?? "").trim() || null,
    type: String(formData.get("type") ?? "").trim() || null,
    location: String(formData.get("location") ?? "").trim() || null,
    area: Number(formData.get("area")) || null,
    units: Number(formData.get("units")) || null,
    style: String(formData.get("style") ?? "").trim() || null,
    status: String(formData.get("status") ?? "active"),
  }).returning();
  await logActivity(user.id, "property.create", "property", row.id);
  revalidatePath("/properties");
}

export async function setPropertyStatus(id: number, status: string) {
  const user = await assertCap("properties:edit");
  const db = await getDb();
  await db.update(properties).set({ status, updatedAt: new Date() }).where(eq(properties.id, id));
  await logActivity(user.id, "property.status", "property", id, { status });
  revalidatePath("/properties");
}
