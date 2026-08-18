"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { payments, projects } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";
import { notifyRoles } from "@/lib/notifications";

async function loadPayment(id: number) {
  const db = await getDb();
  const [p] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  if (!p) throw new Error("Payment not found");
  return p;
}

function revalidate(projectId: number | null) {
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/properties");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

const addSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  kind: z.enum(["downpayment", "milestone", "installment", "final", "service", "other"]),
  label: z.string().trim().min(1, "Add a label."),
  amount: z.coerce.number().int().min(0),
  dueDate: z.string().optional(),
});

export type PayState = { error?: string; ok?: boolean };

export async function addPayment(_prev: PayState, formData: FormData): Promise<PayState> {
  const user = await assertCap("payments:manage");
  const parsed = addSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const db = await getDb();
  const [proj] = await db.select({ propertyId: projects.propertyId }).from(projects).where(eq(projects.id, d.projectId)).limit(1);
  await db.insert(payments).values({
    projectId: d.projectId, propertyId: proj?.propertyId ?? null,
    kind: d.kind, label: d.label, amount: d.amount,
    dueDate: d.dueDate ? new Date(d.dueDate) : null, status: "due", recordedBy: user.id,
  });
  await logActivity(user.id, "payment.add", "project", d.projectId, { amount: d.amount });
  revalidate(d.projectId);
  return { ok: true };
}

const recordSchema = z.object({
  id: z.coerce.number().int().positive(),
  mode: z.enum(["paid", "pending"]),
  method: z.string().trim().optional(),
  reference: z.string().trim().optional(),
  receiptUrl: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

/** Record a payment: mark paid, or log a submitted bank-transfer receipt as pending verification. */
export async function recordPayment(_prev: PayState, formData: FormData): Promise<PayState> {
  const user = await assertCap("payments:manage");
  const parsed = recordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const p = await loadPayment(d.id);
  const db = await getDb();

  const paid = d.mode === "paid";
  await db.update(payments).set({
    status: paid ? "paid" : "pending",
    method: d.method || "bank_transfer",
    reference: d.reference || null,
    receiptUrl: d.receiptUrl || p.receiptUrl,
    note: d.note || p.note,
    paidAt: paid ? new Date() : null,
    verifiedBy: paid ? user.id : null,
    updatedAt: new Date(),
  }).where(eq(payments.id, d.id));

  await logActivity(user.id, paid ? "payment.paid" : "payment.receipt", "payment", d.id, { amount: p.amount });
  if (!paid) {
    await notifyRoles(["ops_manager", "admin"], {
      type: "payment.receipt", title: `Receipt to verify · ${p.label}`,
      body: `EGP ${p.amount.toLocaleString()} awaiting verification`,
      entity: "project", entityId: p.projectId ?? undefined, href: p.projectId ? `/projects/${p.projectId}` : "/payments",
    }, user.id);
  }
  revalidate(p.projectId);
  return { ok: true };
}

export async function verifyPayment(id: number) {
  const user = await assertCap("payments:manage");
  const p = await loadPayment(id);
  const db = await getDb();
  await db.update(payments).set({ status: "paid", paidAt: new Date(), verifiedBy: user.id, updatedAt: new Date() }).where(eq(payments.id, id));
  await logActivity(user.id, "payment.verify", "payment", id, { amount: p.amount });
  revalidate(p.projectId);
}

export async function voidPayment(id: number) {
  const user = await assertCap("payments:manage");
  const p = await loadPayment(id);
  const db = await getDb();
  await db.update(payments).set({ status: "void", updatedAt: new Date() }).where(eq(payments.id, id));
  await logActivity(user.id, "payment.void", "payment", id);
  revalidate(p.projectId);
}
