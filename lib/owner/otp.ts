import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { owners, ownerLoginTokens, type Owner } from "@/lib/db/schema";

const TTL_MS = 15 * 60 * 1000; // codes/links valid 15 minutes

function hashCode(code: string): string {
  const salt = randomBytes(12).toString("hex");
  return salt + ":" + scryptSync(code, salt, 32).toString("hex");
}
function verifyCodeHash(code: string, stored: string): boolean {
  const [salt, key] = String(stored || "").split(":");
  if (!salt || !key) return false;
  const derived = scryptSync(code, salt, 32);
  const keyBuf = Buffer.from(key, "hex");
  return keyBuf.length === derived.length && timingSafeEqual(keyBuf, derived);
}

/** Create a one-time 6-digit code + opaque magic-link token for this email. */
export async function issueLoginCode(email: string): Promise<{ id: string; code: string }> {
  const db = await getDb();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const id = randomBytes(24).toString("hex");
  await db.insert(ownerLoginTokens).values({
    id,
    email: email.toLowerCase().trim(),
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  return { id, code };
}

type SignupExtra = { name?: string | null; phone?: string | null; consent?: boolean; source?: string | null };

async function findOrCreateOwner(email: string, extra?: SignupExtra): Promise<Owner> {
  const db = await getDb();
  const e = email.toLowerCase().trim();
  const [existing] = await db.select().from(owners).where(eq(owners.email, e)).limit(1);
  if (existing) {
    if (!existing.emailVerified) {
      await db.update(owners).set({ emailVerified: new Date() }).where(eq(owners.id, existing.id));
    }
    return existing;
  }
  const [created] = await db
    .insert(owners)
    .values({
      email: e,
      name: (extra?.name || "").trim() || e.split("@")[0],
      phone: extra?.phone || null,
      marketingConsent: !!extra?.consent,
      consentAt: extra?.consent ? new Date() : null,
      source: extra?.source || "site",
      emailVerified: new Date(),
    })
    .returning();
  return created;
}

/**
 * Verify a login attempt by magic-link token OR email+code, consume it (one-time),
 * and return the owner (creating a passwordless account on first sign-in).
 */
export async function consumeLogin(
  input: { token?: string; email?: string; code?: string },
  extra?: SignupExtra
): Promise<Owner | null> {
  const db = await getDb();
  let row: typeof ownerLoginTokens.$inferSelect | undefined;

  if (input.token) {
    const [r] = await db
      .select()
      .from(ownerLoginTokens)
      .where(and(eq(ownerLoginTokens.id, input.token), isNull(ownerLoginTokens.usedAt), gt(ownerLoginTokens.expiresAt, new Date())))
      .limit(1);
    row = r;
  } else if (input.email && input.code) {
    const e = input.email.toLowerCase().trim();
    const [r] = await db
      .select()
      .from(ownerLoginTokens)
      .where(and(eq(ownerLoginTokens.email, e), isNull(ownerLoginTokens.usedAt), gt(ownerLoginTokens.expiresAt, new Date())))
      .orderBy(desc(ownerLoginTokens.createdAt))
      .limit(1);
    if (r && verifyCodeHash(input.code, r.codeHash)) row = r;
  }

  if (!row) return null;
  await db.update(ownerLoginTokens).set({ usedAt: new Date() }).where(eq(ownerLoginTokens.id, row.id));
  return findOrCreateOwner(row.email, extra);
}
