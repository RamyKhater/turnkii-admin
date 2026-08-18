import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";

const COOKIE = "tk_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function createSession(userId: number): Promise<void> {
  const db = await getDb();
  const id = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000);
  await db.insert(sessions).values({ id, userId, expiresAt });
  const store = await cookies();
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (!id) return null;
  const db = await getDb();
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0]?.user ?? null;
  if (!user || !user.active) return null;
  return user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (id) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, id));
  }
  store.delete(COOKIE);
}
