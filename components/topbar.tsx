import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { unreadCount } from "@/lib/notifications";

export async function Topbar() {
  const user = await getCurrentUser();
  const count = user ? await unreadCount(user.id) : 0;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-end gap-2 border-b border-line bg-cream/85 px-6 backdrop-blur lg:px-8">
      <Link
        href="/notifications"
        className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-paper text-ink transition-colors hover:border-ink"
        aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-crit px-1 text-[10px] font-bold text-white tabular">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Link>
    </header>
  );
}
