import { z } from "zod";
import { getDb } from "@/lib/db";
import { whatsappClicks } from "@/lib/db/schema";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const schema = z.object({
  path: z.string().trim().max(300).optional(),
  referrer: z.string().trim().max(500).optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(200).optional(),
  gclid: z.string().trim().max(400).optional(),
  fbclid: z.string().trim().max(400).optional(),
});

// Public beacon: the marketing site posts here when a WhatsApp click-to-chat
// link is tapped. Logged as intent (kept out of `requests`) and counted on the
// dashboard. Fire-and-forget — never surfaces errors to the visitor.
export async function POST(req: Request) {
  const rl = await rateLimit(`wa:${clientIp(req.headers)}`, 20, 60_000);
  if (!rl.ok) return Response.json({ ok: false }, { status: 429, headers: CORS });

  let body: unknown = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const parsed = schema.safeParse(body ?? {});
  const v = parsed.success ? parsed.data : {};

  try {
    const db = await getDb();
    await db.insert(whatsappClicks).values({
      path: v.path,
      referrer: v.referrer,
      utmSource: v.utmSource,
      utmMedium: v.utmMedium,
      utmCampaign: v.utmCampaign,
      gclid: v.gclid,
      fbclid: v.fbclid,
    });
  } catch {
    // never fail a beacon on a DB hiccup
  }
  return Response.json({ ok: true }, { status: 201, headers: CORS });
}
