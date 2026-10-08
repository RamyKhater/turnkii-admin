import { z } from "zod";
import { issueLoginCode } from "@/lib/owner/otp";
import { sendEmail } from "@/lib/email/send";
import { rateLimit } from "@/lib/ratelimit";
import { PUBLIC_SITE_URL } from "@/lib/proposals/link";
import { ACCOUNT_CORS, jsonCors, clientIpOf } from "@/lib/account/http";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: ACCOUNT_CORS });
}

const schema = z.object({
  email: z.string().trim().email(),
  source: z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
  const ip = clientIpOf(req);
  const rl = await rateLimit(`account-code:${ip}`, 6, 60_000);
  if (!rl.ok) return jsonCors({ ok: false, error: "Too many attempts. Please wait a minute." }, 429);

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonCors({ ok: false, error: "Enter a valid email address." }, 400);

  const email = parsed.data.email.toLowerCase().trim();
  const perEmail = await rateLimit(`account-code-email:${email}`, 5, 15 * 60_000);
  if (!perEmail.ok) return jsonCors({ ok: false, error: "Too many codes requested for this email. Please wait." }, 429);

  const { id, code } = await issueLoginCode(email);
  const link = `${PUBLIC_SITE_URL}/account?token=${id}`;
  try {
    await sendEmail({
      to: email,
      subject: `Your Turnkii sign-in code: ${code}`,
      html:
        `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#12130E;">` +
        `<p style="font-size:15px;">Use this code to sign in to Turnkii:</p>` +
        `<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0;">${code}</p>` +
        `<p style="font-size:14px;color:#55564B;">Or just tap this link on this device:</p>` +
        `<p><a href="${link}" style="display:inline-block;background:#12130E;color:#D6F23C;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;">Sign in to Turnkii</a></p>` +
        `<p style="font-size:12px;color:#8A8B7E;margin-top:20px;">The code and link expire in 15 minutes. If you didn't request this, you can ignore this email.</p>` +
        `</div>`,
    });
  } catch {
    // Don't reveal delivery failures / whether the address exists.
  }
  // Always 200 — never disclose whether an account exists for this email.
  return jsonCors({ ok: true });
}
