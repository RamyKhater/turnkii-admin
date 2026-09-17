import { and, eq, asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tasks, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Card } from "@/components/ui";
import { TaskRow } from "./task-row";
import { AddTaskForm } from "./add-task-form";

/** Tasks panel for a request / project / proposal detail page. Server component:
 *  fetches the entity's tasks + assignee list, then renders the interactive bits. */
export async function TasksPanel({ entityType, entityId, back }: {
  entityType: "request" | "project" | "proposal";
  entityId: number;
  back: string;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const canManage = can(user.role, "tasks:manage");

  const db = await getDb();
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.entityType, entityType), eq(tasks.entityId, entityId)))
    .orderBy(asc(tasks.status), asc(tasks.dueDate));

  const people = await db.select({ id: users.id, name: users.name, active: users.active }).from(users);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const assignees = people.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }));

  // Everyone who can open this page sees the tasks; only managers add/delete.
  const open = rows.filter((t) => t.status !== "done").length;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Tasks{open > 0 ? ` · ${open} open` : ""}</h2>
      </div>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-muted">No tasks yet.</p>
        ) : (
          rows.map((t) => (
            <TaskRow key={t.id} task={t} assigneeName={t.assigneeId ? nameOf.get(t.assigneeId) ?? null : null} canManage={canManage} canAct={canManage || t.assigneeId === user.id} back={back} />
          ))
        )}
      </div>
      {canManage && (
        <div className="mt-3">
          <AddTaskForm assignees={assignees} back={back} entityType={entityType} entityId={entityId} />
        </div>
      )}
    </Card>
  );
}
