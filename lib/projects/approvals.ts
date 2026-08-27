"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { projects, projectUpdates, projectMedia, projectSignoffs, payments } from "@/lib/db/schema";
import { requireOwner } from "@/lib/owner/session";
import { logActivity } from "@/lib/activity";

/** Resolve the owner-scoped chain media -> update -> project, or null if not theirs. */
async function ownedMedia(mediaId: number, ownerId: number) {
  const db = await getDb();
  const [m] = await db.select().from(projectMedia).where(eq(projectMedia.id, mediaId)).limit(1);
  if (!m) return null;
  const [u] = await db.select().from(projectUpdates).where(eq(projectUpdates.id, m.updateId)).limit(1);
  if (!u) return null;
  const [p] = await db.select().from(projects).where(eq(projects.id, u.projectId)).limit(1);
  if (!p || p.ownerId !== ownerId) return null;
  return { media: m, update: u, project: p };
}

const decideSchema = z.object({
  mediaId: z.coerce.number().int().positive(),
  decision: z.enum(["accepted", "rejected", "reshoot"]),
  reason: z.string().trim().max(200).optional(),
  comment: z.string().trim().max(500).optional(),
});

export type DecideState = { error?: string; ok?: boolean };

export async function ownerDecideMedia(_prev: DecideState, formData: FormData): Promise<DecideState> {
  const owner = await requireOwner();
  const parsed = decideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { mediaId, decision, reason, comment } = parsed.data;
  if (decision !== "accepted" && !reason) return { error: "Pick a reason." };

  const owned = await ownedMedia(mediaId, owner.id);
  if (!owned) return { error: "Not found." };

  const db = await getDb();
  await db.update(projectMedia).set({
    status: decision,
    reason: decision === "accepted" ? null : reason || null,
    comment: decision === "accepted" ? null : comment || null,
  }).where(eq(projectMedia.id, mediaId));
  await logActivity(null, `owner.media.${decision}`, "project", owned.project.id);
  revalidatePath("/portal");
  revalidatePath(`/projects/${owned.project.id}`);
  return { ok: true };
}

/** Client signs off a milestone once every shared item is accepted. Creates the
 *  immutable sign-off record and releases the milestone payment. */
export async function ownerSignoff(updateId: number): Promise<DecideState> {
  const owner = await requireOwner();
  const db = await getDb();
  const [u] = await db.select().from(projectUpdates).where(eq(projectUpdates.id, updateId)).limit(1);
  if (!u) return { error: "Not found." };
  const [p] = await db.select().from(projects).where(eq(projects.id, u.projectId)).limit(1);
  if (!p || p.ownerId !== owner.id) return { error: "Not found." };

  const items = await db.select().from(projectMedia).where(eq(projectMedia.updateId, updateId));
  if (!items.length || !items.every((it) => it.status === "accepted")) {
    return { error: "Every item must be accepted before you can sign off." };
  }
  const [existing] = await db.select().from(projectSignoffs).where(eq(projectSignoffs.updateId, updateId)).limit(1);
  if (existing && !existing.voidedAt) return { ok: true };

  const ref = "TK-SO-" + p.id + "-" + String(updateId).padStart(2, "0");
  await db.insert(projectSignoffs).values({
    updateId, ref, signedByName: owner.name, signedByRole: "Owner", ownerId: owner.id,
    itemCount: items.length, method: "Account sign-off, verified mobile", amount: u.amount ?? 0,
  });

  // Release the milestone payment (idempotent: only once).
  if (!u.paymentId && (u.amount ?? 0) > 0) {
    const [pay] = await db.insert(payments).values({
      projectId: p.id, kind: "milestone", label: u.milestone || u.stage || u.title,
      amount: u.amount ?? 0, status: "due", dueDate: new Date(),
      note: `Released on client sign-off ${ref}`,
    }).returning();
    await db.update(projectUpdates).set({ paymentId: pay.id }).where(eq(projectUpdates.id, updateId));
  }
  await logActivity(null, "owner.signoff", "project", p.id);
  revalidatePath("/portal");
  revalidatePath(`/projects/${p.id}`);
  return { ok: true };
}
