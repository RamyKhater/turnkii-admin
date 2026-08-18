import "server-only";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { notifications, users, type Role } from "@/lib/db/schema";

type Payload = {
  type: string;
  title: string;
  body?: string;
  entity?: string;
  entityId?: string | number;
  href?: string;
};

export async function notify(userId: number, p: Payload) {
  const db = await getDb();
  await db.insert(notifications).values({
    userId,
    type: p.type,
    title: p.title,
    body: p.body,
    entity: p.entity,
    entityId: p.entityId != null ? String(p.entityId) : null,
    href: p.href,
  });
}

/** Fan out a notification to every active user holding one of the given roles. */
export async function notifyRoles(roles: Role[], p: Payload, exclude?: number) {
  const db = await getDb();
  const recipients = await db.select({ id: users.id, role: users.role, active: users.active }).from(users);
  const targets = recipients.filter((u) => u.active && roles.includes(u.role) && u.id !== exclude);
  if (!targets.length) return;
  await db.insert(notifications).values(
    targets.map((u) => ({
      userId: u.id, type: p.type, title: p.title, body: p.body,
      entity: p.entity, entityId: p.entityId != null ? String(p.entityId) : null, href: p.href,
    })),
  );
}

export async function listNotifications(userId: number, limit = 30) {
  const db = await getDb();
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadCount(userId: number): Promise<number> {
  const rows = await listNotifications(userId, 100);
  return rows.filter((n) => !n.read).length;
}

export async function markRead(userId: number, id: number) {
  const db = await getDb();
  await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllRead(userId: number) {
  const db = await getDb();
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
}
