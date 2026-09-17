"use client";
import Link from "next/link";
import { useTransition } from "react";
import { setTaskStatus, deleteTask } from "@/lib/tasks/actions";

export type TaskView = {
  id: number;
  title: string;
  notes: string | null;
  status: string;
  priority: string;
  assigneeId: number | null;
  dueDate: Date | string | null;
  entityLabel?: string | null;
  entityHref?: string | null;
};

const STATUS: [string, string][] = [
  ["open", "Open"], ["in_progress", "In progress"], ["blocked", "Blocked"], ["done", "Done"],
];
const STATUS_STYLE: Record<string, string> = {
  open: "bg-sand text-sub", in_progress: "bg-info/10 text-info", blocked: "bg-crit/10 text-crit", done: "bg-ok/15 text-ok",
};
const PRIO_STYLE: Record<string, string> = { high: "bg-crit/10 text-crit", normal: "bg-sand text-sub", low: "bg-info/10 text-info" };

export function TaskRow({ task, assigneeName, canManage, canAct, back }: {
  task: TaskView; assigneeName: string | null; canManage: boolean; canAct?: boolean; back: string;
}) {
  const mayAct = canAct ?? canManage;
  const [pending, start] = useTransition();
  const fd = (extra: Record<string, string>) => {
    const f = new FormData();
    f.set("id", String(task.id));
    f.set("back", back);
    Object.entries(extra).forEach(([k, v]) => f.set(k, v));
    return f;
  };
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && task.status !== "done" && due.getTime() < Date.now();

  return (
    <div className={`rounded-xl border border-line p-3 ${task.status === "done" ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-sm font-semibold ${task.status === "done" ? "line-through" : ""}`}>{task.title}</div>
          {task.notes && <div className="mt-0.5 whitespace-pre-line text-xs text-sub">{task.notes}</div>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>{assigneeName ? `→ ${assigneeName}` : "Unassigned"}</span>
            {task.entityLabel && task.entityHref && (
              <Link href={task.entityHref} className="font-semibold text-olive hover:underline">{task.entityLabel}</Link>
            )}
            {due && <span className={overdue ? "font-semibold text-crit" : ""}>Due {due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
            {task.priority !== "normal" && <span className={`rounded-full px-2 py-0.5 font-bold capitalize ${PRIO_STYLE[task.priority] ?? ""}`}>{task.priority}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mayAct ? (
            <select
              value={task.status}
              disabled={pending}
              onChange={(e) => start(() => setTaskStatus(fd({ status: e.target.value })))}
              className={`rounded-full px-2.5 py-1 text-xs font-bold outline-none disabled:opacity-50 ${STATUS_STYLE[task.status] ?? "bg-sand text-sub"}`}
            >
              {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : (
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS_STYLE[task.status] ?? "bg-sand text-sub"}`}>
              {STATUS.find(([v]) => v === task.status)?.[1] ?? task.status}
            </span>
          )}
          {canManage && (
            <button
              type="button"
              disabled={pending}
              onClick={() => { if (confirm("Delete this task?")) start(() => deleteTask(fd({}))); }}
              className="text-xs font-semibold text-crit hover:underline disabled:opacity-50"
              aria-label="Delete task"
            >✕</button>
          )}
        </div>
      </div>
    </div>
  );
}
