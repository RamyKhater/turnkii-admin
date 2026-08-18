import { requireUser } from "@/lib/auth/guard";
import { unreadCount } from "@/lib/notifications";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const unread = await unreadCount(user.id);
  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role }} unread={unread}>
      {children}
    </AppShell>
  );
}
