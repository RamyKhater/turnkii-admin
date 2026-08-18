"use client";
import { useActionState, useTransition } from "react";
import { postProjectUpdate, deleteProjectUpdate, type UpdateState } from "@/lib/projects/actions";
import { ImageField } from "@/components/content/image-field";
import type { ProjectUpdate } from "@/lib/db/schema";

const input = "rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink";
const lbl = "text-xs font-bold uppercase tracking-wider text-muted";

const KIND: Record<string, { label: string; dot: string }> = {
  progress: { label: "Progress", dot: "bg-info" },
  milestone: { label: "Milestone", dot: "bg-ok" },
  photo: { label: "Photo", dot: "bg-olive" },
  note: { label: "Note", dot: "bg-muted" },
};

export function PostUpdateForm({ projectId }: { projectId: number }) {
  const [state, action, pending] = useActionState<UpdateState, FormData>(postProjectUpdate, {});
  return (
    <form action={action} key={state.ok ? Date.now() : "f"} className="flex flex-col gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="flex flex-wrap gap-3">
        <div className="flex-1"><label className="flex flex-col gap-1.5"><span className={lbl}>Title</span><input name="title" required placeholder="e.g. Kitchen carcasses installed" className={input} /></label></div>
        <label className="flex flex-col gap-1.5"><span className={lbl}>Type</span>
          <select name="kind" defaultValue="progress" className={input + " font-semibold"}>
            <option value="progress">Progress</option><option value="milestone">Milestone</option><option value="photo">Photo</option><option value="note">Note</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5"><span className={lbl}>Details</span><textarea name="body" rows={2} className={input} /></label>
      <ImageField name="image" label="Photo (optional)" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2.5 text-sm font-semibold"><input type="checkbox" name="visibleToOwner" defaultChecked className="h-4 w-4 accent-ink" /> Visible to the owner in their portal</label>
        <div className="flex items-center gap-3">
          {state.error && <span className="text-sm font-medium text-crit">{state.error}</span>}
          <button type="submit" disabled={pending} className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream hover:bg-lime hover:text-ink disabled:opacity-60">
            {pending ? "Posting…" : "Post update"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function UpdateRow({ update, authorName, canManage }: { update: ProjectUpdate; authorName?: string; canManage: boolean }) {
  const [pending, start] = useTransition();
  const k = KIND[update.kind] ?? KIND.note;
  return (
    <li className="flex gap-3">
      <div className="mt-1 flex flex-col items-center">
        <span className={`h-2.5 w-2.5 rounded-full ${k.dot}`} />
        <span className="mt-1 w-px flex-1 bg-line" />
      </div>
      <div className="flex-1 pb-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-sand px-2 py-0.5 font-bold uppercase tracking-wider text-sub">{k.label}</span>
          <span>{authorName ?? "Team"}</span>
          <span>· {new Date(update.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
          {!update.visibleToOwner && <span className="rounded-full bg-warn/15 px-2 py-0.5 font-bold text-warn">Internal</span>}
          {canManage && (
            <button onClick={() => { if (confirm("Delete this update?")) start(() => deleteProjectUpdate(update.id, update.projectId)); }} disabled={pending} className="ml-auto font-bold text-muted hover:text-crit disabled:opacity-50">Delete</button>
          )}
        </div>
        <div className="mt-1 font-semibold">{update.title}</div>
        {update.body && <p className="mt-0.5 text-sm text-sub">{update.body}</p>}
        {update.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={update.image} alt="" className="mt-2 max-h-56 rounded-xl border border-line object-cover" />
        )}
      </div>
    </li>
  );
}
