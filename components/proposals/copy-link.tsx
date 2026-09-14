"use client";
import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 font-mono text-xs text-ink"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            /* clipboard blocked — the field is selectable as a fallback */
          }
        }}
        className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream hover:bg-ink/90"
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink"
      >
        Preview
      </a>
    </div>
  );
}
