"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const num = (v: FormDataEntryValue | null) => {
  const n = Number(str(v));
  return Number.isInteger(n) && n > 0 ? n : null;
};
const ENTITIES = new Set(["request", "project", "proposal"]);
const STATUSES = new Set(["open", "in_progress", "blocked", "done"]);
const PRIORITIES = new Set(["low", "normal", "high"]);

/** Where to send the page after a mutation — the form passes its own path so the
 *  same action works from the Tasks page and from every detail panel. */
function revalidateBack(formData: FormData) {
  const back = str(formData.get("back"));
  if (back.startsWith("/")) revalidatePath(back);
  revalidatePath("/tasks");
}

export async function createTask(formData: FormData) {
  const user = await assertCap("tasks:manage");
  const title = str(formData.get("title"));
  if (!title) return;
  const assigneeId = num(formData.get("assigneeId"));
  const priority = PRIORITIES.has(str(formData.get("priority"))) ? str(formData.get("priority")) : "normal";
  const entityType = ENTITIES.has(str(formData.get("entityType"))) ? str(formData.get("entityType")) : null;
  const entityId = entityType ? num(formData.get("entityId")) : null;
  const dueRaw = str(formData.get("dueDate"));
  const due = dueRaw ? new Date(dueRaw) : null;

  const db = await getDb();
  const [row] = await db
    .insert(tasks)
    .values({
      title: title.slice(0, 300),
      notes: str(formData.get("notes")).slice(0, 4000) || null,
      assigneeId,
      createdBy: user.id,
      priority,
      entityType,
      entityId,
      dueDate: due && !isNaN(due.getTime()) ? due : null,
    })
    .returning({ id: tasks.id });

  await logActivity(user.id, "task.create", "task", String(row.id), { assigneeId, entityType });
  if (assigneeId && assigneeId !== user.id) {
    await notify(assigneeId, {
      type: "task.assigned",
      title: `New task: ${title.slice(0, 80)}`,
      body: entityType ? `On ${entityType} #${entityId}` : undefined,
      entity: "task",
      entityId: row.id,
      href: "/tasks",
    });
  }
  revalidateBack(formData);
}

/** Assignees can move their own task; managers can move any. */
export async function setTaskStatus(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const id = num(formData.get("id"));
  const status = str(formData.get("status"));
  if (!id || !STATUSES.has(status)) throw new Error("Invalid task update");

  const db = await getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task) throw new Error("Task not found");
  if (task.assigneeId !== user.id && !can(user.role, "tasks:manage")) throw new Error("Not authorized");

  await db
    .update(tasks)
    .set({ status: status as "open" | "in_progress" | "blocked" | "done", completedAt: status === "done" ? new Date() : null, updatedAt: new Date() })
    .where(eq(tasks.id, id));
  await logActivity(user.id, "task.status", "task", String(id), { status });
  revalidateBack(formData);
}

export async function updateTask(formData: FormData) {
  const user = await assertCap("tasks:manage");
  const id = num(formData.get("id"));
  if (!id) throw new Error("Invalid task");
  const priority = PRIORITIES.has(str(formData.get("priority"))) ? str(formData.get("priority")) : "normal";
  const dueRaw = str(formData.get("dueDate"));
  const due = dueRaw ? new Date(dueRaw) : null;
  const db = await getDb();
  await db
    .update(tasks)
    .set({
      title: str(formData.get("title")).slice(0, 300) || undefined,
      notes: str(formData.get("notes")).slice(0, 4000) || null,
      assigneeId: num(formData.get("assigneeId")),
      priority,
      dueDate: due && !isNaN(due.getTime()) ? due : null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id));
  await logActivity(user.id, "task.update", "task", String(id));
  revalidateBack(formData);
}

export async function deleteTask(formData: FormData) {
  const user = await assertCap("tasks:manage");
  const id = num(formData.get("id"));
  if (!id) throw new Error("Invalid task");
  const db = await getDb();
  await db.delete(tasks).where(eq(tasks.id, id));
  await logActivity(user.id, "task.delete", "task", String(id));
  revalidateBack(formData);
}
