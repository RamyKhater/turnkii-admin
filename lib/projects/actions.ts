"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { projects, projectUpdates, projectMedia, projectSignoffs, payments, notifications, properties } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";
import { photoQA, draftUpdateNote, rejectionToTasks } from "@/lib/ai/progress";
import { deliveryDigest, type ProjectSignal } from "@/lib/ai/delivery";

const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";
const splitCsv = (v: FormDataEntryValue | null) =>
  String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const projectSchema = z.object({
  name: z.string().trim().min(2, "Add a project name."),
  propertyId: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  style: z.string().trim().optional(),
  contractValue: z.coerce.number().int().min(0).optional(),
  status: z.enum(["active", "on_hold", "complete"]),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
});

async function ownerFieldsFor(propertyId?: number) {
  if (!propertyId) return {};
  const db = await getDb();
  const [p] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
  if (!p) return {};
  return { propertyId, ownerId: p.ownerId ?? null, ownerName: p.ownerName, ownerPhone: p.ownerPhone, ownerEmail: p.ownerEmail };
}

export async function createProject(formData: FormData) {
  const user = await assertCap("payments:manage");
  const parsed = projectSchema.parse(Object.fromEntries(formData));
  const db = await getDb();
  const [row] = await db.insert(projects).values({
    name: parsed.name,
    ...(await ownerFieldsFor(parsed.propertyId)),
    style: parsed.style,
    services: splitCsv(formData.get("services")),
    contractValue: parsed.contractValue ?? 0,
    status: parsed.status,
    startDate: parsed.startDate ? new Date(parsed.startDate) : null,
    dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
  }).returning();
  await logActivity(user.id, "project.create", "project", row.id);
  revalidatePath("/projects");
  redirect(`/projects/${row.id}`);
}

export async function updateProject(formData: FormData) {
  const user = await assertCap("payments:manage");
  const id = Number(formData.get("id"));
  const parsed = projectSchema.parse(Object.fromEntries(formData));
  const db = await getDb();
  await db.update(projects).set({
    name: parsed.name,
    ...(await ownerFieldsFor(parsed.propertyId)),
    style: parsed.style,
    services: splitCsv(formData.get("services")),
    contractValue: parsed.contractValue ?? 0,
    status: parsed.status,
    startDate: parsed.startDate ? new Date(parsed.startDate) : null,
    dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
    updatedAt: new Date(),
  }).where(eq(projects.id, id));
  await logActivity(user.id, "project.update", "project", id);
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  redirect(`/projects/${id}`);
}

const updateSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, "Add a title."),
  kind: z.enum(["progress", "milestone", "photo", "note"]),
  body: z.string().trim().optional(),
  image: z.string().trim().optional(),
  visibleToOwner: z.any().optional(),
});
export type UpdateState = { error?: string; ok?: boolean };

export async function postProjectUpdate(_prev: UpdateState, formData: FormData): Promise<UpdateState> {
  const user = await assertCap("payments:manage");
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const db = await getDb();
  await db.insert(projectUpdates).values({
    projectId: d.projectId, authorId: user.id, title: d.title, kind: d.kind,
    body: d.body, image: d.image || null, visibleToOwner: bool(formData.get("visibleToOwner")),
  });
  await logActivity(user.id, "project.update.post", "project", d.projectId);
  revalidatePath(`/projects/${d.projectId}`);
  revalidatePath("/portal");
  return { ok: true };
}

export async function deleteProjectUpdate(id: number, projectId: number) {
  const user = await assertCap("payments:manage");
  const db = await getDb();
  await db.delete(projectUpdates).where(eq(projectUpdates.id, id));
  await logActivity(user.id, "project.update.delete", "project", projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/portal");
}

// ── Progress & approvals layer ────────────────────────────────────────────────

const mediaItemSchema = z.object({
  type: z.enum(["photo", "video"]).default("photo"),
  url: z.string().trim().min(1),
  caption: z.string().trim().optional(),
});
const sendUpdateSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  stage: z.string().trim().min(1, "Name the stage."),
  milestone: z.string().trim().optional(),
  amount: z.coerce.number().int().min(0).optional(),
  body: z.string().trim().optional(),
});

/** Share a progress update with media items, run photo QA, and notify the owner. */
export async function sendProgressUpdate(_prev: UpdateState, formData: FormData): Promise<UpdateState> {
  const user = await assertCap("projects:manage");
  const parsed = sendUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  let items: z.infer<typeof mediaItemSchema>[] = [];
  try { items = z.array(mediaItemSchema).parse(JSON.parse(String(formData.get("media") || "[]"))); } catch { items = []; }
  if (!items.length) return { error: "Attach at least one photo or video." };

  const db = await getDb();
  const [proj] = await db.select().from(projects).where(eq(projects.id, d.projectId)).limit(1);
  if (!proj) return { error: "Project not found." };

  const [update] = await db.insert(projectUpdates).values({
    projectId: d.projectId, authorId: user.id,
    title: d.stage, stage: d.stage, milestone: d.milestone || d.stage,
    body: d.body || null, kind: "milestone", amount: d.amount ?? 0,
    visibleToOwner: true, sentAt: new Date(),
  }).returning();

  // Run photo QA in parallel (best-effort; never blocks the share).
  const rows = await Promise.all(items.map(async (it, i) => {
    const qa = it.type === "photo" ? await photoQA(it.url, { milestone: update.milestone, stage: update.stage }) : null;
    return {
      updateId: update.id, type: it.type, url: it.url,
      caption: it.caption || qa?.caption || null,
      aiCaption: qa?.caption || null,
      aiFlags: qa ? { severity: qa.severity, issues: qa.issues, ok: qa.ok } : null,
      status: "pending" as const, sort: i,
    };
  }));
  await db.insert(projectMedia).values(rows);

  if (proj.ownerId) {
    await db.insert(notifications).values({
      userId: null, type: "project.update", title: "New progress update",
      body: `${proj.name}: ${d.stage}`, entity: "project", entityId: String(proj.id), href: "/portal",
    }).catch(() => {});
  }
  await logActivity(user.id, "project.update.send", "project", d.projectId);
  revalidatePath(`/projects/${d.projectId}`);
  revalidatePath("/portal");
  return { ok: true };
}

/** Crew marked a rejected/re-shoot item as redone — back to pending for the client. */
export async function resolveMedia(mediaId: number, projectId: number) {
  const user = await assertCap("projects:manage");
  const db = await getDb();
  await db.update(projectMedia).set({ status: "pending", reason: null, comment: null }).where(eq(projectMedia.id, mediaId));
  await logActivity(user.id, "project.media.resolve", "project", projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/portal");
}

export async function unshareMedia(mediaId: number, projectId: number) {
  const user = await assertCap("projects:manage");
  const db = await getDb();
  await db.delete(projectMedia).where(eq(projectMedia.id, mediaId));
  await logActivity(user.id, "project.media.unshare", "project", projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/portal");
}

/** Void a client sign-off (immutable: records voidedAt, voids the released payment). */
export async function voidSignoff(signoffId: number, projectId: number) {
  const user = await assertCap("projects:manage");
  const db = await getDb();
  const [so] = await db.select().from(projectSignoffs).where(eq(projectSignoffs.id, signoffId)).limit(1);
  if (!so) return;
  await db.update(projectSignoffs).set({ voidedAt: new Date(), voidedReason: "Voided by admin" }).where(eq(projectSignoffs.id, signoffId));
  const [upd] = await db.select().from(projectUpdates).where(eq(projectUpdates.id, so.updateId)).limit(1);
  if (upd?.paymentId) await db.update(payments).set({ status: "void", updatedAt: new Date() }).where(eq(payments.id, upd.paymentId));
  await logActivity(user.id, "project.signoff.void", "project", projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/portal");
}

// ── AI assists (return results to the client UI; some also persist) ───────────

export async function aiDraftNote(input: { stage?: string; milestone?: string; items: { caption?: string | null; type?: string }[] }): Promise<{ note: string }> {
  await assertCap("projects:manage");
  return { note: await draftUpdateNote(input) };
}

export async function aiRunPhotoQA(mediaId: number, projectId: number): Promise<{ ok: boolean; severity: string; issues: string[]; caption: string }> {
  await assertCap("projects:manage");
  const db = await getDb();
  const [m] = await db.select().from(projectMedia).where(eq(projectMedia.id, mediaId)).limit(1);
  if (!m) return { ok: true, severity: "none", issues: [], caption: "" };
  const [upd] = await db.select().from(projectUpdates).where(eq(projectUpdates.id, m.updateId)).limit(1);
  const qa = await photoQA(m.url, { milestone: upd?.milestone, stage: upd?.stage });
  await db.update(projectMedia).set({ aiCaption: qa.caption || m.aiCaption, aiFlags: { severity: qa.severity, issues: qa.issues, ok: qa.ok } }).where(eq(projectMedia.id, mediaId));
  revalidatePath(`/projects/${projectId}`);
  return qa;
}

export async function aiRejectionTasks(mediaId: number): Promise<{ tasks: string[] }> {
  await assertCap("projects:manage");
  const db = await getDb();
  const [m] = await db.select().from(projectMedia).where(eq(projectMedia.id, mediaId)).limit(1);
  if (!m) return { tasks: [] };
  return { tasks: await rejectionToTasks({ caption: m.caption, status: m.status, reason: m.reason, comment: m.comment }) };
}

// ── AI delivery-risk digest ───────────────────────────────────────────────────

export async function aiDeliveryDigest(): Promise<{ text: string }> {
  await assertCap("projects:manage");
  const db = await getDb();
  const [projRows, updRows, mediaRows, payRows] = await Promise.all([
    db.select().from(projects),
    db.select().from(projectUpdates),
    db.select().from(projectMedia),
    db.select().from(payments),
  ]);
  const now = Date.now();
  const DAY = 86_400_000;
  const mediaByUpdate = new Map<number, typeof mediaRows>();
  for (const m of mediaRows) { const a = mediaByUpdate.get(m.updateId) ?? []; a.push(m); mediaByUpdate.set(m.updateId, a); }

  const signals: ProjectSignal[] = projRows
    .filter((p) => p.status !== "complete")
    .map((p) => {
      const ups = updRows.filter((u) => u.projectId === p.id);
      const items = ups.flatMap((u) => mediaByUpdate.get(u.id) ?? []);
      const lastSent = ups.reduce<number | null>((acc, u) => {
        const t = (u.sentAt ?? u.createdAt).getTime();
        return acc == null || t > acc ? t : acc;
      }, null);
      const signable = ups.filter((u) => {
        const mi = mediaByUpdate.get(u.id) ?? [];
        return mi.length > 0 && mi.every((m) => m.status === "accepted");
      }).length;
      const overdue = payRows
        .filter((pay) => pay.projectId === p.id && (pay.status === "due" || pay.status === "pending") && pay.dueDate && pay.dueDate.getTime() < now)
        .reduce((a, pay) => a + pay.amount, 0);
      return {
        name: p.name, status: p.status,
        lastUpdateDaysAgo: lastSent == null ? null : Math.floor((now - lastSent) / DAY),
        dueInDays: p.dueDate ? Math.round((p.dueDate.getTime() - now) / DAY) : null,
        blockedItems: items.filter((m) => m.status === "rejected" || m.status === "reshoot").length,
        awaitingClient: items.filter((m) => m.status === "pending").length,
        signable,
        overdueAmountEGP: overdue,
      };
    });
  return { text: await deliveryDigest(signals) };
}
