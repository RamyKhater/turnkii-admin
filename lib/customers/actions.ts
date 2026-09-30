"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { owners } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { canAccessSection } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";

async function guard() {
  const user = await requireUser();
  if (!canAccessSection(user.role, "customers")) throw new Error("You don't have access to customers.");
  return user;
}

/** Edit a customer account (owner): name, email, phone, active. */
export async function updateOwner(formData: FormData) {
  const user = await guard();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Bad customer id");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const active = ["on", "true"].includes(String(formData.get("active") ?? ""));
  if (!name || !email) throw new Error("Name and email are required.");

  const db = await getDb();
  try {
    await db.update(owners).set({ name, email, phone, active }).where(eq(owners.id, id));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/unique|duplicate/i.test(msg)) throw new Error("Another customer already uses that email.");
    throw e;
  }
  await logActivity(user.id, "owner.update", "owner", id, { active });
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  redirect(`/customers/${id}`);
}
