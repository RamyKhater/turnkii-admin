"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import type { Role } from "@/lib/db/schema";

export function AppShell({
  user,
  unread,
  children,
}: {
  user: { name: string; email: string; role: Role };
  unread: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // close the drawer on route change and lock body scroll while open
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar user={user} />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 animate-[slidein_.18s_ease-out]">
            <Sidebar user={user} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col bg-cream">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-cream/85 px-4 backdrop-blur lg:px-8">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-paper hover:border-ink lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-[18px] w-[18px]"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink font-serif text-base font-bold text-lime">t</span>
            <span className="font-bold tracking-tight">Turnkii</span>
          </Link>

          <Link
            href="/notifications"
            className="relative ml-auto grid h-9 w-9 place-items-center rounded-full border border-line bg-paper text-ink hover:border-ink"
            aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-crit px-1 text-[10px] font-bold text-white tabular">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <style>{`@keyframes slidein{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
    </div>
  );
}
