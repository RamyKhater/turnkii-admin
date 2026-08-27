"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth/actions";
import { canAccessSection, ROLE_LABEL } from "@/lib/auth/rbac";
import type { Role } from "@/lib/db/schema";

type NavItem = {
  href: string;
  label: string;
  section: "dashboard" | "requests" | "properties" | "projects" | "pricing" | "payments" | "content" | "users" | "settings";
  icon: React.ReactNode;
};

const I = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
    <path d={d} />
  </svg>
);

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", section: "dashboard", icon: I("M3 13h8V3H3zM13 21h8v-8h-8zM13 3v6h8V3zM3 21h8v-4H3z") },
  { href: "/requests", label: "Requests", section: "requests", icon: I("M4 6h16M4 12h16M4 18h10") },
  { href: "/properties", label: "Properties", section: "properties", icon: I("M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9 21v-6h6v6") },
  { href: "/projects", label: "Projects", section: "projects", icon: I("M3 7h7l2 3h9v9H3zM3 7V5h6l2 2") },
  { href: "/pricing", label: "Pricing", section: "pricing", icon: I("M20 12l-8 8-9-9V4h7zM7.5 7.5h.01") },
  { href: "/payments", label: "Payments", section: "payments", icon: I("M2 7h20v10H2zM2 11h20M6 15h4") },
  { href: "/content", label: "Content", section: "content", icon: I("M12 20h9M3 20h4M4 4h16v10H4zM8 8h8M8 11h5") },
  { href: "/users", label: "Team", section: "users", icon: I("M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87") },
  { href: "/settings", label: "Settings", section: "settings", icon: I("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z") },
];

export function Sidebar({
  user,
  onNavigate,
}: {
  user: { name: string; email: string; role: Role };
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = NAV.filter((n) => canAccessSection(user.role, n.section));

  return (
    <aside className="flex h-dvh w-60 shrink-0 flex-col border-r border-line bg-ink text-cream lg:sticky lg:top-0">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-lime font-serif text-base font-bold text-ink">t</span>
        <span className="font-bold tracking-tight">Turnkii</span>
        <span className="ml-auto rounded-full border border-cream/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cream/60">Admin</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {items.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                active ? "bg-lime text-ink" : "text-cream/70 hover:bg-cream/10 hover:text-cream"
              }`}
            >
              {n.icon}
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-cream/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream/10 text-sm font-bold text-lime">
            {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{user.name}</span>
            <span className="block truncate text-xs text-cream/50">{ROLE_LABEL[user.role]}</span>
          </span>
        </div>
        <form action={logout}>
          <button className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-cream/60 transition-colors hover:bg-cream/10 hover:text-cream">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
