"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guard";
import { markRead, markAllRead } from "@/lib/notifications";

export async function markNotificationRead(id: number) {
  const user = await requireUser();
  await markRead(user.id, id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await markAllRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
