import { z } from "zod";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { subscribers } from "@/lib/db/schema";
import { rateLimit } from "@/lib/ratelimit";
import { ACCOUNT_CORS, jsonCors, clientIpOf } from "@/lib/account/http";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: ACCOUNT_CORS });
}

const schema = z.object({
  email: z.string().trim().email(),
  consent: z.boolean().optional(),
  source: z.string().trim().max(40).optional(),
});

/** Newsletter / offers opt-in — works with or without an account (footer form). */
export async function POST(req: Request) {
  const rl = await rateLimit(`account-subscribe:${clientIpOf(req)}`, 10, 60_000);
  if (!rl.ok) return jsonCors({ ok: false, error: "Too many attempts. Please wait a minute." }, 429);
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonCors({ ok: false, error: "Enter a valid email address." }, 400);

  const email = parsed.data.email.toLowerCase().trim();
  const db = await getDb();
  const [existing] = await db.select({ id: subscribers.id }).from(subscribers).where(eq(subscribers.email, email)).limit(1);
  if (existing) {
    await db.update(subscribers).set({ consent: parsed.data.consent ?? true }).where(eq(subscribers.id, existing.id));
    return jsonCors({ ok: true });
  }
  await db.insert(subscribers).values({
    email,
    consent: parsed.data.consent ?? true,
    source: parsed.data.source || "site",
    unsubToken: randomBytes(16).toString("hex"),
  });
  return jsonCors({ ok: true });
}
