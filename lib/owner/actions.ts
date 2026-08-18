"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { owners, payments, projects, properties } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createOwnerSession, destroyOwnerSession, getCurrentOwner } from "./session";
import { logActivity } from "@/lib/activity";
import { notifyRoles } from "@/lib/notifications";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export type OwnerLoginState = { error?: string };

export async function ownerLogin(_prev: OwnerLoginState, formData: FormData): Promise<OwnerLoginState> {
  const rl = await rateLimit(`owner-login:${clientIp(await headers())}`, 10, 60_000);
  if (!rl.ok) return { error: "Too many attempts. Please wait a minute and try again." };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const db = await getDb();
  const [owner] = await db.select().from(owners).where(eq(owners.email, parsed.data.email.toLowerCase().trim())).limit(1);
  if (!owner || !owner.active || !verifyPassword(parsed.data.password, owner.passwordHash)) {
    return { error: "Those details don't match an account." };
  }
  await createOwnerSession(owner.id);
  redirect("/portal");
}

export async function ownerLogout(): Promise<void> {
  await destroyOwnerSession();
  redirect("/portal/login");
}

/** Confirm a payment belongs to the signed-in owner (via its project or property). */
async function ownsPayment(ownerId: number, paymentId: number) {
  const db = await getDb();
  const [p] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!p) return null;
  let owns = false;
  if (p.projectId) {
    const [pr] = await db.select({ ownerId: projects.ownerId }).from(projects).where(eq(projects.id, p.projectId)).limit(1);
    if (pr?.ownerId === ownerId) owns = true;
  }
  if (!owns && p.propertyId) {
    const [prop] = await db.select({ ownerId: properties.ownerId }).from(properties).where(eq(properties.id, p.propertyId)).limit(1);
    if (prop?.ownerId === ownerId) owns = true;
  }
  return owns ? p : null;
}

const receiptSchema = z.object({
  id: z.coerce.number().int().positive(),
  reference: z.string().trim().optional(),
  receiptUrl: z.string().trim().min(1, "Attach your bank transfer receipt."),
  note: z.string().trim().optional(),
});
export type ReceiptState = { error?: string; ok?: boolean };

/** Owner submits proof of a bank transfer → payment goes to "pending" for staff to verify. */
export async function submitOwnerReceipt(_prev: ReceiptState, formData: FormData): Promise<ReceiptState> {
  const owner = await getCurrentOwner();
  if (!owner) return { error: "Please sign in again." };
  const parsed = receiptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const payment = await ownsPayment(owner.id, parsed.data.id);
  if (!payment) return { error: "That payment isn't on your account." };
  if (payment.status === "paid" || payment.status === "void") return { error: "That payment is already settled." };

  const db = await getDb();
  await db.update(payments).set({
    status: "pending", method: "bank_transfer",
    reference: parsed.data.reference || payment.reference,
    receiptUrl: parsed.data.receiptUrl,
    note: parsed.data.note || payment.note,
    updatedAt: new Date(),
  }).where(eq(payments.id, payment.id));

  await logActivity(null, "owner.receipt", "payment", payment.id, { owner: owner.email, amount: payment.amount });
  await notifyRoles(["ops_manager", "admin"], {
    type: "payment.receipt", title: `Owner receipt · ${payment.label}`,
    body: `${owner.name} submitted EGP ${payment.amount.toLocaleString()} for verification`,
    entity: "project", entityId: payment.projectId ?? undefined,
    href: payment.projectId ? `/projects/${payment.projectId}` : "/payments",
  });

  revalidatePath("/portal");
  revalidatePath("/portal/payments");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { ok: true };
}
