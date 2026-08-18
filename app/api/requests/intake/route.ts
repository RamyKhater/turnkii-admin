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
      channel: parsed.data.channel || "Direct",
      referrer: parsed.data.referrer,
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
