import { requireUser } from "@/lib/auth/guard";
import { listNotifications } from "@/lib/notifications";
import { PageHeader } from "@/components/ui";
import { NotificationList } from "@/components/notifications/list";

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id, 50);

  return (
    <>
      <PageHeader eyebrow="Inbox" title="Notifications" sub="New requests, assignments and SLA alerts." />
      <div className="max-w-2xl p-6 lg:p-8">
        <NotificationList items={items} />
      </div>
    </>
  );
}
