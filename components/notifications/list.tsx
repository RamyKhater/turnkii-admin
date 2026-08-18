"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/notifications/actions";
import type { Notification } from "@/lib/db/schema";

function ago(d: Date) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationList({ items }: { items: Notification[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const anyUnread = items.some((n) => !n.read);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => start(() => markAllNotificationsRead())}
          disabled={!anyUnread || pending}
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink disabled:opacity-40"
        >
          Mark all read
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-paper">
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() =>
              start(async () => {
                await markNotificationRead(n.id);
                if (n.href) router.push(n.href);
              })
            }
            className={`flex w-full items-start gap-3 border-b border-line px-5 py-4 text-left last:border-0 transition-colors hover:bg-sand/40 ${
              n.read ? "" : "bg-lime/5"
            }`}
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-line" : "bg-lime"}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{n.title}</span>
              {n.body && <span className="block text-sm text-sub">{n.body}</span>}
            </span>
            <span className="shrink-0 text-xs text-muted tabular">{ago(n.createdAt)}</span>
          </button>
        ))}
        {items.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted">You&apos;re all caught up.</div>
        )}
      </div>
    </div>
  );
}
