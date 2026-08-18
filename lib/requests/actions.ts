"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requests, requestNotes, type RequestStatus } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";
import { notify, notifyRoles } from "@/lib/notifications";
import { STATUS_META } from "@/components/ui";
import type { User } from "@/lib/db/schema";

async function loadRequest(id: number) {
  const db = await getDb();
  const [req] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!req) throw new Error("Request not found");
  return req;
}

/** Agents may only act on requests assigned to them. */
function ensureOwnership(user: User, assignedTo: number | null) {
  if (user.role === "agent" && assignedTo !== user.id) {
    throw new Error("This request isn't assigned to you.");
  }
}

const statusSchema = z.enum([
  "new", "contacted", "survey_booked", "scoped", "quoted", "won", "lost",
]);

export async function updateStatus(id: number, status: RequestStatus) {
  const user = await assertCap("requests:update");
  const parsed = statusSchema.parse(status);
  const req = await loadRequest(id);
  ensureOwnership(user, req.assignedTo);

  const now = new Date();
  const set: Partial<typeof requests.$inferInsert> = { status: parsed, updatedAt: now };
  // First contact → stamp first-response time for SLA.
  if (parsed !== "new" && !req.firstResponseAt) set.firstResponseAt = now;
  // Reaching a terminal state → resolution time; leaving it clears resolvedAt.
  if (parsed === "won" || parsed === "lost") set.resolvedAt = now;
  else if (req.resolvedAt) set.resolvedAt = null;

  const db = await getDb();
  await db.update(requests).set(set).where(eq(requests.id, id));
  await db.insert(requestNotes).values({
    requestId: id, authorId: user.id, kind: "status",
    body: `Status changed to ${STATUS_META[parsed].label}.`,
  });
  await logActivity(user.id, "request.status", "request", id, { status: parsed });
  revalidatePath(`/requests/${id}`);
  revalidatePath("/requests");
  revalidatePath("/dashboard");
}

const createSchema = z.object({
  contactName: z.string().trim().min(1, "Name is required."),
  phone: z.string().trim().min(3, "Phone is required."),
  email: z.string().email().optional().or(z.literal("")),
  propertyType: z.string().trim().optional(),
  area: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  units: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  location: z.string().trim().optional(),
  style: z.string().trim().optional(),
  budgetPlan: z.string().trim().optional(),
  channel: z.string().trim().optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  assignedTo: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  message: z.string().trim().optional(),
});

export type CreateRequestState = { error?: string };

export async function createRequest(_prev: CreateRequestState, formData: FormData): Promise<CreateRequestState> {
  const user = await assertCap("requests:create");
  const raw = Object.fromEntries(formData);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const services = formData.getAll("services").map(String).map((s) => s.trim()).filter(Boolean);

  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(requests);
  const ref = `TK-${2400 + n}`;

  const [row] = await db.insert(requests).values({
    ref, contactName: d.contactName, phone: d.phone, email: d.email || null,
    propertyType: d.propertyType, area: d.area, units: d.units, location: d.location,
    services, style: d.style, budgetPlan: d.budgetPlan, priority: d.priority,
    channel: d.channel || "Direct",
    message: d.message, status: "new", assignedTo: d.assignedTo ?? null, source: "manual",
  }).returning();

  await logActivity(user.id, "request.create", "request", row.id, { source: "manual" });
  await notifyRoles(["ops_manager", "admin"], {
    type: "request.new", title: `New request ${ref}`,
    body: `${d.contactName} · ${d.location ?? ""}`.trim(), entity: "request", entityId: row.id, href: `/requests/${row.id}`,
  }, user.id);
  if (d.assignedTo) {
    await notify(d.assignedTo, {
      type: "request.assigned", title: `Assigned to you: ${ref}`,
      body: d.contactName, entity: "request", entityId: row.id, href: `/requests/${row.id}`,
    });
  }
  revalidatePath("/requests");
  revalidatePath("/dashboard");
  redirect(`/requests/${row.id}`);
}

export async function assignRequest(id: number, assigneeId: number | null) {
  const user = await assertCap("requests:assign");
  const db = await getDb();
  const req = await loadRequest(id);
  await db.update(requests).set({ assignedTo: assigneeId, updatedAt: new Date() }).where(eq(requests.id, id));
  await db.insert(requestNotes).values({
    requestId: id, authorId: user.id, kind: "status",
    body: assigneeId ? "Reassigned this request." : "Unassigned this request.",
  });
  await logActivity(user.id, "request.assign", "request", id, { assigneeId });
  if (assigneeId && assigneeId !== user.id) {
    await notify(assigneeId, {
      type: "request.assigned", title: `Assigned to you: ${req.ref}`,
      body: req.contactName ?? undefined, entity: "request", entityId: id, href: `/requests/${id}`,
    });
  }
  revalidatePath(`/requests/${id}`);
  revalidatePath("/requests");
  revalidatePath("/dashboard");
}

const noteSchema = z.object({
  id: z.coerce.number().int().positive(),
  kind: z.enum(["note", "call", "survey"]),
  body: z.string().trim().min(1, "Write something first.").max(2000),
});

export type NoteState = { error?: string; ok?: boolean };

export async function addNote(_prev: NoteState, formData: FormData): Promise<NoteState> {
  const user = await assertCap("requests:note");
  const parsed = noteSchema.safeParse({
    id: formData.get("id"),
    kind: formData.get("kind"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = parsed.data.id;

  const req = await loadRequest(id);
  ensureOwnership(user, req.assignedTo);

  const db = await getDb();
  await db.insert(requestNotes).values({
    requestId: id, authorId: user.id, kind: parsed.data.kind, body: parsed.data.body,
  });
  await logActivity(user.id, "request.note", "request", id, { kind: parsed.data.kind });
  revalidatePath(`/requests/${id}`);
  return { ok: true };
}

export async function deleteRequest(id: number) {
  const user = await assertCap("requests:delete");
  if (!can(user.role, "requests:delete")) throw new Error("Not authorized");
  const db = await getDb();
  await db.delete(requests).where(eq(requests.id, id));
  await logActivity(user.id, "request.delete", "request", id);
  revalidatePath("/requests");
  revalidatePath("/dashboard");
}
