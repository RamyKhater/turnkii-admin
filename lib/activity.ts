import "server-only";
import { getDb } from "@/lib/db";
import { activityLog } from "@/lib/db/schema";

export async function logActivity(
  userId: number | null,
  action: string,
  entity?: string,
  entityId?: string | number,
  meta?: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  await db.insert(activityLog).values({
    userId,
    action,
    entity,
    entityId: entityId != null ? String(entityId) : null,
    meta,
  });
}
