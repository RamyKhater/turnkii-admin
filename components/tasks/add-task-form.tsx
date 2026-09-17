"use client";
import { useState, useTransition } from "react";
import { createTask } from "@/lib/tasks/actions";

export type Assignee = { id: number; name: string; team?: string | null };

export function AddTaskForm({ assignees, back, entityType, entityId }: {
  assignees: Assignee[];
  back: string;
  entityType?: "request" | "project" | "proposal";
  entityId?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const inp = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">
        + Add task
      </button>
    );
  }
  return (
    <form
      action={(f) => start(() => createTask(f).then(() => setOpen(false)))}
      className="grid gap-2.5 rounded-xl border border-line bg-paper p-4"
    >
      <input type="hidden" name="back" value={back} />
      {entityType && <input type="hidden" name="entityType" value={entityType} />}
      {entityId != null && <input type="hidden" name="entityId" value={entityId} />}
      <input name="title" required placeholder="Task — e.g. Draft the kitchen layout" className={inp} autoFocus />
      <textarea name="notes" rows={2} placeholder="Notes (optional)" className={inp} />
      <div className="grid gap-2.5 sm:grid-cols-3">
        <select name="assigneeId" defaultValue="" className={`${inp} font-medium`}>
          <option value="">Assign to…</option>
          {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}{a.team ? ` · ${a.team}` : ""}</option>)}
        </select>
        <select name="priority" defaultValue="normal" className={`${inp} font-medium`}>
          <option value="low">Low priority</option>
          <option value="normal">Normal</option>
          <option value="high">High priority</option>
        </select>
        <input name="dueDate" type="date" className={inp} />
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60">
          {pending ? "Adding…" : "Add task"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">Cancel</button>
      </div>
    </form>
  );
}
