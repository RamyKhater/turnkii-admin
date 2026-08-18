"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { projects, projectUpdates, properties } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";

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
