"use client";
import { useActionState } from "react";
import { publishSite, type PublishResult } from "@/lib/content/publish";

export function PublishButton({ lastPublished }: { lastPublished: string | null }) {
  const [state, action, pending] = useActionState<PublishResult | null>(
    async () => await publishSite(),
    null,
  );

  const note = state?.message
    ? state.message
    : lastPublished
      ? `Last published ${new Date(lastPublished).toLocaleString()}`
      : "Not published to the site yet";

  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-6 py-2.5 text-sm font-bold text-cream hover:bg-lime hover:text-ink disabled:opacity-50"
      >
        {pending ? "Publishing…" : "Publish to website"}
      </button>
      <span className="max-w-xs text-right text-xs text-sub">{note}</span>
    </form>
  );
}
