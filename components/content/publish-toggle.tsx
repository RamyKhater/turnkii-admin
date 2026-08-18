"use client";
import { useTransition } from "react";
import { togglePublish } from "@/lib/content/actions";

export function PublishToggle({
  entity,
  id,
  published,
}: {
  entity: "style" | "product" | "inspiration" | "service" | "handover";
  id: number;
  published: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => togglePublish(entity, id, !published))}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
        published ? "bg-ok/12 text-ok hover:bg-ok/20" : "bg-sand text-muted hover:bg-line"
      }`}
      title="Toggle published"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${published ? "bg-ok" : "bg-muted"}`} />
      {published ? "Published" : "Draft"}
    </button>
  );
}
