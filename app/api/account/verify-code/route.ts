import { z } from "zod";
import { consumeLogin } from "@/lib/owner/otp";
import { createOwnerSessionToken } from "@/lib/owner/session";
import { rateLimit } from "@/lib/ratelimit";
import { ACCOUNT_CORS, jsonCors, clientIpOf } from "@/lib/account/http";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: ACCOUNT_CORS });
}

const schema = z.object({
  token: z.string().trim().min(10).optional(),
  email: z.string().trim().email().optional(),
  code: z.string().trim().regex(/^\d{6}$/).optional(),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  consent: z.boolean().optional(),
  source: z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
  const ip = clientIpOf(req);
  const rl = await rateLimit(`account-verify:${ip}`, 12, 60_000);
  if (!rl.ok) return jsonCors({ ok: false, error: "Too many attempts. Please wait a minute." }, 429);

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = schema.safeParse(body);
  if (!parsed.success || (!parsed.data.token && !(parsed.data.email && parsed.data.code))) {
    return jsonCors({ ok: false, error: "Enter the 6-digit code we emailed you." }, 400);
  }

  const d = parsed.data;
  const owner = await consumeLogin(
    { token: d.token, email: d.email, code: d.code },
    { name: d.name, phone: d.phone, consent: d.consent, source: d.source }
  );
  if (!owner) return jsonCors({ ok: false, error: "That code is invalid or has expired. Request a new one." }, 401);

  const token = await createOwnerSessionToken(owner.id);
  return jsonCors({
    ok: true,
    token,
    owner: { id: owner.id, name: owner.name, email: owner.email, marketingConsent: owner.marketingConsent },
  });
}
