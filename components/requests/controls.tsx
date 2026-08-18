"use client";
import { useTransition } from "react";
import { useActionState } from "react";
import { updateStatus, assignRequest, addNote, type NoteState } from "@/lib/requests/actions";
import { PIPELINE, STATUS_META } from "@/components/ui";
import type { RequestStatus } from "@/lib/db/schema";

export function StatusControl({
  id,
  current,
  disabled,
}: {
  id: number;
  current: RequestStatus;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      value={current}
      disabled={disabled || pending}
      onChange={(e) => start(() => updateStatus(id, e.target.value as RequestStatus))}
      className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold outline-none focus:border-ink disabled:opacity-60"
    >
      {PIPELINE.map((s) => (
        <option key={s} value={s}>{STATUS_META[s].label}</option>
      ))}
    </select>
  );
}

export function AssignControl({
  id,
  current,
  owners,
  disabled,
}: {
  id: number;
  current: number | null;
  owners: { id: number; name: string }[];
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      value={current ?? ""}
      disabled={disabled || pending}
      onChange={(e) => start(() => assignRequest(id, e.target.value ? Number(e.target.value) : null))}
      className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold outline-none focus:border-ink disabled:opacity-60"
    >
      <option value="">Unassigned</option>
      {owners.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );
}

export function NoteForm({ id }: { id: number }) {
  const [state, action, pending] = useActionState<NoteState, FormData>(addNote, {});
  return (
    <form action={action} className="flex flex-col gap-2" key={state.ok ? Date.now() : "form"}>
      <input type="hidden" name="id" value={id} />
      <div className="flex items-center gap-2">
        <select name="kind" className="rounded-full border border-line bg-paper px-3 py-2 text-sm font-semibold outline-none focus:border-ink">
          <option value="note">Note</option>
          <option value="call">Call log</option>
          <option value="survey">Survey</option>
        </select>
        <span className="text-xs text-muted">Logged against this request</span>
      </div>
      <textarea
        name="body"
        rows={3}
        required
        placeholder="Add a note, log a call, or record a survey…"
        className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-ink"
      />
      {state.error && <p className="text-sm font-medium text-crit">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream hover:bg-lime hover:text-ink disabled:opacity-60"
      >
        {pending ? "Saving…" : "Add to timeline"}
      </button>
    </form>
  );
}
