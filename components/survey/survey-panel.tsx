"use client";
import { useRef, useState, useTransition } from "react";
import { addSurveyFile, deleteSurveyFile, updateSurveyNote, linkSurveyToProject } from "@/lib/survey/actions";

export type SurveyFileView = {
  id: number;
  kind: string;
  url: string;
  name: string;
  contentType: string | null;
  size: number | null;
  note: string | null;
  createdAt: Date | string;
};
type ProjectOpt = { id: number; name: string };

const fmtSize = (b: number | null) => (b == null ? "" : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const isImg = (f: SurveyFileView) => f.kind === "image" || (f.contentType ?? "").startsWith("image/");

export function SurveyPanel({ requestId, files, projects, linkedProjectId, canLink }: {
  requestId: number;
  files: SurveyFileView[];
  projects: ProjectOpt[];
  linkedProjectId: number | null;
  canLink: boolean;
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(list: FileList | null) {
    if (!list || !list.length) return;
    setBusy(true); setError(null);
    try {
      for (const file of Array.from(list)) {
        const fd = new FormData(); fd.set("file", file);
        const res = await fetch("/api/files", { method: "POST", body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.url) { setError(j.error || `Couldn't upload ${file.name}`); continue; }
        const af = new FormData();
        af.set("requestId", String(requestId)); af.set("url", j.url); af.set("name", j.name);
        af.set("kind", j.kind); af.set("contentType", j.type); af.set("size", String(j.size));
        await addSurveyFile(af);
      }
    } catch { setError("Upload failed. Please try again."); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60"
        >
          {busy ? "Uploading…" : "+ Upload documents or photos"}
        </button>
        <span className="text-xs text-muted">PDF, Office docs, images, CSV, DWG/DXF, ZIP · up to 40MB each</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.dwg,.dxf,.zip"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>
      {error && <p className="mt-2 text-sm font-medium text-crit">{error}</p>}

      <div className="mt-4 space-y-2">
        {files.length === 0 ? (
          <p className="text-xs text-muted">No survey files yet. Upload the measurements, report and site photos here.</p>
        ) : (
          files.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
              {isImg(f) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="shrink-0"><img src={f.url} alt="" className="h-12 w-12 rounded-lg border border-line object-cover" /></a>
              ) : (
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-line bg-sand text-lg">📄</a>
              )}
              <div className="min-w-0 flex-1">
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-semibold text-ink hover:text-olive">{f.name}</a>
                <div className="text-xs text-muted">{fmtSize(f.size)} · {new Date(f.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                <form action={updateSurveyNote} className="mt-1.5">
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="requestId" value={requestId} />
                  <input
                    name="note"
                    defaultValue={f.note ?? ""}
                    placeholder="Add a note (optional)…"
                    onBlur={(e) => { if (e.currentTarget.value !== (f.note ?? "")) e.currentTarget.form?.requestSubmit(); }}
                    className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs outline-none focus:border-ink"
                  />
                </form>
              </div>
              <form action={deleteSurveyFile}>
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="requestId" value={requestId} />
                <button
                  type="submit"
                  onClick={(e) => { if (!confirm(`Delete “${f.name}”?`)) e.preventDefault(); }}
                  className="shrink-0 text-xs font-semibold text-crit hover:underline"
                >Remove</button>
              </form>
            </div>
          ))
        )}
      </div>

      {canLink && files.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Link to project</span>
          <select
            defaultValue={linkedProjectId ? String(linkedProjectId) : ""}
            disabled={pending}
            onChange={(e) => {
              const fd = new FormData();
              fd.set("requestId", String(requestId));
              if (e.target.value) fd.set("projectId", e.target.value);
              start(() => linkSurveyToProject(fd));
            }}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-ink"
          >
            <option value="">— Not linked —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="text-xs text-muted">These files then appear on the project.</span>
        </div>
      )}
    </div>
  );
}
