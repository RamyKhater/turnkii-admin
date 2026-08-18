import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ownerSessions, owners, type Owner } from "@/lib/db/schema";

const COOKIE = "tk_owner";
const MAX_AGE = 60 * 60 * 24 * 30;

export async function createOwnerSession(ownerId: number): Promise<void> {
  const db = await getDb();
  const id = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000);
  await db.insert(ownerSessions).values({ id, ownerId, expiresAt });
  const store = await cookies();
  store.set(COOKIE, id, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: MAX_AGE,
  });
}

export async function getCurrentOwner(): Promise<Owner | null> {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (!id) return null;
  const db = await getDb();
  const rows = await db
    .select({ owner: owners })
    .from(ownerSessions)
    .innerJoin(owners, eq(ownerSessions.ownerId, owners.id))
    .where(and(eq(ownerSessions.id, id), gt(ownerSessions.expiresAt, new Date())))
    .limit(1);
  const owner = rows[0]?.owner ?? null;
  if (!owner || !owner.active) return null;
  return owner;
}

export async function destroyOwnerSession(): Promise<void> {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (id) {
    const db = await getDb();
    await db.delete(ownerSessions).where(eq(ownerSessions.id, id));
  }
  store.delete(COOKIE);
}

/** Page guard for the owner portal. */
export async function requireOwner(): Promise<Owner> {
  const owner = await getCurrentOwner();
  if (!owner) redirect("/portal/login");
  return owner;
}
