"use client";
import { useState, useRef, useEffect } from "react";

const ITEMS = [
  { dataset: "requests", label: "All requests" },
  { dataset: "sources", label: "Traffic sources" },
  { dataset: "services", label: "Service types" },
  { dataset: "users", label: "Team performance" },
  { dataset: "payments", label: "Payments" },
];

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-sm font-bold hover:border-ink"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        Export
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-lg">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Download CSV (Excel)</div>
          {ITEMS.map((it) => (
            <a
              key={it.dataset}
              href={`/api/export?dataset=${it.dataset}`}
              download
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm font-semibold hover:bg-sand"
            >
              {it.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
