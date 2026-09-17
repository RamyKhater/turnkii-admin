import { desc, asc, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { tasks, users, requests, projects, proposals } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { TaskRow, type TaskView } from "@/components/tasks/task-row";
import { AddTaskForm } from "@/components/tasks/add-task-form";

const RANK: Record<string, number> = { in_progress: 0, open: 1, blocked: 2, done: 3 };

export default async function TasksPage() {
  const user = await requireUser();
  const canManage = can(user.role, "tasks:manage");
  const db = await getDb();

  const all = canManage
    ? await db.select().from(tasks).orderBy(desc(tasks.createdAt))
    : await db.select().from(tasks).where(eq(tasks.assigneeId, user.id)).orderBy(desc(tasks.createdAt));

  // Resolve entity labels for the linked request / project / proposal.
  const idsOf = (type: string) => all.filter((t) => t.entityType === type && t.entityId).map((t) => t.entityId as number);
  const reqIds = idsOf("request"), projIds = idsOf("project"), propIds = idsOf("proposal");
  const reqRows = reqIds.length ? await db.select({ id: requests.id, ref: requests.ref }).from(requests).where(inArray(requests.id, reqIds)) : [];
  const projRows = projIds.length ? await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projIds)) : [];
  const propRows = propIds.length ? await db.select({ id: proposals.id, title: proposals.title }).from(proposals).where(inArray(proposals.id, propIds)) : [];
  const reqRef = new Map(reqRows.map((r) => [r.id, r.ref]));
  const projName = new Map(projRows.map((r) => [r.id, r.name]));
  const propTitle = new Map(propRows.map((r) => [r.id, r.title]));

  const people = await db.select({ id: users.id, name: users.name, active: users.active }).from(users);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const assignees = people.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }));

  function meta(t: typeof all[number]): { label: string | null; href: string | null } {
    if (t.entityType === "request" && t.entityId) return { label: `Request ${reqRef.get(t.entityId) ?? t.entityId}`, href: `/requests/${t.entityId}` };
    if (t.entityType === "project" && t.entityId) return { label: projName.get(t.entityId) ?? `Project #${t.entityId}`, href: `/projects/${t.entityId}` };
    if (t.entityType === "proposal" && t.entityId) return { label: propTitle.get(t.entityId) ?? `Proposal #${t.entityId}`, href: `/proposals/${t.entityId}` };
    return { label: null, href: null };
  }

  const sorted = [...all].sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9));
  const openCount = all.filter((t) => t.status !== "done").length;

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title={canManage ? "Tasks" : "My tasks"}
        sub={canManage ? "Assign and track work across the team, linked to requests, projects and proposals." : "Work assigned to you. Update status as you go."}
      />
      <div className="space-y-5 p-6 lg:p-8">
        {canManage && (
          <Card className="p-6">
            <h2 className="text-sm font-bold">New task</h2>
            <p className="mb-3 mt-1 text-xs text-sub">Standalone tasks. To link one to a specific request, project or proposal, add it from that item's page.</p>
            <AddTaskForm assignees={assignees} back="/tasks" />
          </Card>
        )}

        <Card className="p-5">
          <h2 className="text-sm font-bold">{canManage ? "All tasks" : "Assigned to me"}{openCount > 0 ? ` · ${openCount} open` : ""}</h2>
          <div className="mt-3 space-y-2">
            {sorted.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No tasks yet.</p>
            ) : (
              sorted.map((t) => {
                const m = meta(t);
                const view: TaskView = { ...t, entityLabel: m.label, entityHref: m.href };
                return (
                  <TaskRow
                    key={t.id}
                    task={view}
                    assigneeName={t.assigneeId ? nameOf.get(t.assigneeId) ?? null : null}
                    canManage={canManage}
                    canAct={canManage || t.assigneeId === user.id}
                    back="/tasks"
                  />
                );
              })
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
