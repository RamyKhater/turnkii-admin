"use client";
import { useActionState, useState, useTransition } from "react";
import { shareSurveyWithFlpp, acceptSow, requestSowEdit, attachSowToProject, type SowReviewState } from "@/lib/flpp/actions";
import type { SowComment } from "@/lib/db/schema";

export function ShareSurveyButton({ requestId, sharedAt, ready }: { requestId: number; sharedAt: Date | null; ready: boolean }) {
  const [pending, start] = useTransition();
  if (sharedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/20 px-3 py-1 text-xs font-bold text-olive">
        Shared with flpp · {sharedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={!ready || pending}
      title={ready ? "" : "Attach survey files or a survey note first"}
      onClick={() => start(() => shareSurveyWithFlpp(requestId))}
      className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-olive disabled:opacity-40"
    >
      {pending ? "Sharing…" : "Share survey with flpp →"}
    </button>
  );
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  in_review: { label: "In review", cls: "bg-info/10 text-info" },
  changes_requested: { label: "Changes requested", cls: "bg-crit/10 text-crit" },
  shared: { label: "Accepted · customer link live", cls: "bg-lime/20 text-olive" },
  viewed: { label: "Viewed by customer", cls: "bg-lime/20 text-olive" },
};

export function SowReviewPanel({
  requestId,
  token,
  docRef,
  status,
  comments,
  customerUrl,
  projectId,
  projects,
}: {
  requestId: number;
  token: string;
  docRef: string;
  status: string;
  comments: SowComment[];
  customerUrl: string | null;
  projectId: number | null;
  projects: { id: number; name: string }[];
}) {
  const [pendingAccept, startAccept] = useTransition();
  const [pendingLink, startLink] = useTransition();
  const [linkedProject, setLinkedProject] = useState<number | null>(projectId);
  const [state, editAction, editing] = useActionState<SowReviewState, FormData>(requestSowEdit, {});
  const meta = STATUS_META[status] ?? STATUS_META.in_review;
  const accepted = status === "shared" || status === "viewed";

  const onLink = (value: string) => startLink(async () => {
    const next = value ? Number(value) : null;
    await attachSowToProject(requestId, token, next);
    setLinkedProject(next);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-mono text-sm font-bold text-ink">{docRef}</span>
          <span className={`ml-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.cls}`}>{meta.label}</span>
        </div>
      </div>

      {accepted && customerUrl && (
        <div className="rounded-xl bg-lime/10 p-3 text-sm">
          <p className="font-semibold text-olive">Customer link</p>
          <a href={customerUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block break-all font-mono text-xs text-ink underline hover:text-olive">{customerUrl}</a>
        </div>
      )}

      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted">Project</label>
        <select
          value={linkedProject ?? ""}
          disabled={pendingLink}
          onChange={(e) => onLink(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold outline-none focus:border-ink disabled:opacity-60"
        >
          <option value="">Not attached to a project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {linkedProject && (
          <a href={`/projects/${linkedProject}`} className="mt-1 inline-block text-xs font-semibold text-olive hover:underline">Open project →</a>
        )}
      </div>

      {comments.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Review comments</h3>
          <ol className="mt-2 space-y-2">
            {comments.map((c, i) => (
              <li key={i} className="rounded-lg border border-line p-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="rounded-full bg-sand px-2 py-0.5 font-bold uppercase tracking-wider text-sub">R{c.round} · {c.role}</span>
                  <span>{c.author}</span>
                  <span>· {new Date(c.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
                <p className="mt-1 text-ink">{c.body}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!accepted && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button
            type="button"
            disabled={pendingAccept}
            onClick={() => startAccept(async () => { await acceptSow(requestId, token); })}
            className="rounded-full bg-olive px-4 py-2 text-sm font-semibold text-paper hover:bg-ink disabled:opacity-40"
          >
            {pendingAccept ? "Accepting…" : "Accept & share with customer"}
          </button>
          <span className="text-xs text-muted">Accepting publishes the customer view + PDF link.</span>
        </div>
      )}

      {!accepted && (
        <form action={editAction} className="space-y-2 rounded-xl bg-sand/40 p-3">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="token" value={token} />
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Request edit as</label>
            <select name="author" defaultValue="ops" className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm font-semibold outline-none focus:border-ink">
              <option value="ops">Operations</option>
              <option value="design">Design</option>
              <option value="admin">Admin</option>
              <option value="customer">Customer comment</option>
            </select>
          </div>
          <textarea
            name="body"
            rows={2}
            required
            placeholder="What should flpp revise? (e.g. add MEP scope, correct area, adjust milestones)"
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink"
          />
          {state.error && <p className="text-xs font-semibold text-crit">{state.error}</p>}
          <button
            type="submit"
            disabled={editing}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink disabled:opacity-40"
          >
            {editing ? "Sending…" : "Request edit from flpp"}
          </button>
        </form>
      )}
    </div>
  );
}
