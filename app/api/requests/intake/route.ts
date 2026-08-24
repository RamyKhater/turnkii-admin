import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requests } from "@/lib/db/schema";
import { logActivity } from "@/lib/activity";
import { notifyRoles } from "@/lib/notifications";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({
  contactName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(4).max(40),
  email: z.string().email().optional().or(z.literal("")),
  propertyType: z.string().trim().max(60).optional(),
  area: z.coerce.number().int().positive().max(100000).optional(),
  units: z.coerce.number().int().positive().max(10000).optional(),
  location: z.string().trim().max(120).optional(),
  services: z.array(z.string().max(60)).max(20).optional(),
  style: z.string().trim().max(60).optional(),
  budgetPlan: z.string().trim().max(60).optional(),
  channel: z.string().trim().max(60).optional(),
  referrer: z.string().trim().max(500).optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(200).optional(),
  utmTerm: z.string().trim().max(200).optional(),
  utmContent: z.string().trim().max(200).optional(),
  gclid: z.string().trim().max(400).optional(),
  fbclid: z.string().trim().max(400).optional(),
  message: z.string().trim().max(4000).optional(),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const rl = await rateLimit(`intake:${clientIp(req.headers)}`, 5, 60_000);
  if (!rl.ok) {
    return Response.json({ error: "Too many submissions. Please try again in a minute." }, { status: 429, headers: CORS });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid submission", issues: parsed.error.flatten() },
      { status: 422, headers: CORS },
    );
  }

  // Derive a clean acquisition channel from the UTM/click params so it feeds the
  // existing traffic-source insights (campaign detail is kept separately).
  const d = parsed.data;
  const src = (d.utmSource || "").toLowerCase();
  const med = (d.utmMedium || "").toLowerCase();
  const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
  let channel: string;
  if (src) {
    if (/cpc|ppc|paid/.test(med)) channel = /google|bing|search/.test(src) ? "Paid search" : "Paid social";
    else if (/email|newsletter/.test(med)) channel = "Email";
    else if (/social/.test(med) || /facebook|instagram|tiktok|linkedin|twitter|x\.com/.test(src)) channel = "Organic social";
    else if (/google|bing|organic/.test(src)) channel = "Organic search";
    else channel = cap(src);
  } else if (d.gclid) channel = "Paid search";
  else if (d.fbclid) channel = "Paid social";
  else channel = d.channel || "Direct";

  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(requests);
  const ref = `TK-${2400 + n}`;

  const [row] = await db
    .insert(requests)
    .values({
      ref,
      contactName: parsed.data.contactName,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      propertyType: parsed.data.propertyType,
      area: parsed.data.area,
      units: parsed.data.units,
      location: parsed.data.location,
      services: parsed.data.services ?? [],
      style: parsed.data.style,
      budgetPlan: parsed.data.budgetPlan,
      channel,
      referrer: parsed.data.referrer,
      utmSource: d.utmSource,
      utmMedium: d.utmMedium,
      utmCampaign: d.utmCampaign,
      utmTerm: d.utmTerm,
      utmContent: d.utmContent,
      gclid: d.gclid,
      fbclid: d.fbclid,
      message: parsed.data.message,
      status: "new",
      source: "website",
    })
    .returning({ id: requests.id, ref: requests.ref });

  await logActivity(null, "request.intake", "request", row.id, { source: "website" });
  await notifyRoles(["ops_manager", "admin"], {
    type: "request.new",
    title: `New website request ${row.ref}`,
    body: `${parsed.data.contactName} · ${parsed.data.location ?? ""}`.trim(),
    entity: "request",
    entityId: row.id,
    href: `/requests/${row.id}`,
  });

  return Response.json({ ok: true, ref: row.ref }, { status: 201, headers: CORS });
}
