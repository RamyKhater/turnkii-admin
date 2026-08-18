"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { PIPELINE, STATUS_META } from "@/components/ui";

export function FilterBar({
  owners,
  showOwner,
}: {
  owners: { id: number; name: string }[];
  showOwner: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) setParam("q", q);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const sel = "rounded-full border border-line bg-paper px-3 py-2 text-sm font-semibold outline-none focus:border-ink";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ref, name, location…"
          className="w-56 rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-ink"
        />
      </div>

      <select value={params.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)} className={sel}>
        <option value="">All statuses</option>
        {PIPELINE.map((s) => (
          <option key={s} value={s}>{STATUS_META[s].label}</option>
        ))}
      </select>

      {showOwner && (
        <select value={params.get("owner") ?? ""} onChange={(e) => setParam("owner", e.target.value)} className={sel}>
          <option value="">All owners</option>
          <option value="unassigned">Unassigned</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )}

      <select value={params.get("source") ?? ""} onChange={(e) => setParam("source", e.target.value)} className={sel}>
        <option value="">All origins</option>
        <option value="website">Website</option>
        <option value="phone">Phone</option>
        <option value="manual">Manual</option>
      </select>

      <select value={params.get("channel") ?? ""} onChange={(e) => setParam("channel", e.target.value)} className={sel}>
        <option value="">All sources</option>
        {["Direct", "Organic search", "Paid search", "Paid social", "Organic social", "Referral", "Email", "WhatsApp", "Walk-in"].map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {(params.get("status") || params.get("owner") || params.get("source") || params.get("channel") || params.get("q")) && (
        <button onClick={() => router.push(pathname)} className="rounded-full px-3 py-2 text-sm font-semibold text-sub hover:text-ink">
          Clear
        </button>
      )}
    </div>
  );
}
