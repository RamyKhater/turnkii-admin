import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { referrers } from "@/lib/db/schema";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(4).max(40),
  email: z.string().email().optional().or(z.literal("")),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function makeCode(name: string): string {
  const initials = name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "TK";
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${initials}${rand}`;
}

export async function POST(req: Request) {
  const rl = await rateLimit(`referral:${clientIp(req.headers)}`, 6, 60_000);
  if (!rl.ok) return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429, headers: CORS });

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid submission" }, { status: 422, headers: CORS });

  const db = await getDb();
  const phone = parsed.data.phone;

  // One code per phone: reuse an existing referrer if this phone already signed up.
  const existing = await db.select().from(referrers).where(eq(referrers.phone, phone)).limit(1);
  if (existing.length) return Response.json({ ok: true, code: existing[0].code }, { status: 200, headers: CORS });

  // Generate a unique code (retry a few times on the rare collision).
  let code = makeCode(parsed.data.name);
  for (let i = 0; i < 5; i++) {
    const clash = await db.select({ id: referrers.id }).from(referrers).where(eq(referrers.code, code)).limit(1);
    if (!clash.length) break;
    code = makeCode(parsed.data.name);
  }

  await db.insert(referrers).values({ code, name: parsed.data.name, phone, email: parsed.data.email || null });
  return Response.json({ ok: true, code }, { status: 201, headers: CORS });
}
