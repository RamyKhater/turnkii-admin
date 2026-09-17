"use client";
import { useTransition } from "react";
import { startProjectFromRequest } from "@/lib/projects/actions";

export function StartProjectButton({ requestId }: { requestId: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Start a new project from this request? Its details and any survey files will carry over.")) return;
        const fd = new FormData();
        fd.set("requestId", String(requestId));
        start(() => startProjectFromRequest(fd));
      }}
      className="rounded-full bg-olive px-4 py-2 text-sm font-semibold text-cream hover:bg-olive/90 disabled:opacity-60"
    >
      {pending ? "Starting…" : "Start project from this request →"}
    </button>
  );
}
