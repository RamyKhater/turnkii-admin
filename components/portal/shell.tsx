import Link from "next/link";
import { ownerLogout } from "@/lib/owner/actions";
import type { Owner } from "@/lib/db/schema";

export function PortalShell({ owner, active, children }: { owner: Owner; active: "home" | "payments"; children: React.ReactNode }) {
  const link = (href: string, label: string, key: string) => (
    <Link href={href} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${active === key ? "bg-ink text-cream" : "text-sub hover:text-ink"}`}>{label}</Link>
  );
  return (
    <div className="min-h-dvh bg-cream">
      <header className="sticky top-0 z-30 border-b border-line bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-5 py-3">
          <Link href="/portal" className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink font-serif text-base font-bold text-lime">t</span>
            <span className="font-bold tracking-tight">Turnkii</span>
            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">Owners</span>
          </Link>
          <nav className="flex items-center gap-1">
            {link("/portal", "Home", "home")}
            {link("/portal/payments", "Payments", "payments")}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm font-semibold sm:block">{owner.name}</span>
            <form action={ownerLogout}>
              <button className="rounded-full border border-line px-3.5 py-1.5 text-sm font-semibold hover:border-ink">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
    </div>
  );
}
