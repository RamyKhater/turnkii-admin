import { randomBytes } from "crypto";
import { after } from "next/server";
import { and, isNotNull, ne, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requests, siteSettings } from "@/lib/db/schema";
import { mergeBooking } from "@/lib/booking/config";
import { slotIsOpen } from "@/lib/booking/availability";
import { logActivity } from "@/lib/activity";
import { notifyRoles } from "@/lib/notifications";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { dispatchBookingEmails } from "@/lib/email/booking";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(4).max(40),
  email: z.string().trim().email().optional().or(z.literal("")),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().trim().regex(/^\d{1,2}:\d{2}$/),
  type: z.enum(["online", "site"]),
  location: z.string().trim().max(200).optional(),
  propertyType: z.string().trim().max(60).optional(),
  services: z.array(z.string().trim().max(60)).max(20).optional(),
  message: z.string().trim().max(2000).optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(160).optional(),
  gclid: z.string().trim().max(200).optional(),
  fbclid: z.string().trim().max(200).optional(),
});

async function loadBooked(): Promise<Record<string, number>> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({ day: requests.visitDay, slot: requests.visitSlot })
    .from(requests)
    .where(and(isNotNull(requests.visitDay), ne(requests.status, "lost"), gte(requests.visitDay, today)));
  const map: Record<string, number> = {};
  for (const r of rows) { if (r.day && r.slot) { const k = `${r.day} ${r.slot}`; map[k] = (map[k] ?? 0) + 1; } }
  return map;
}

export async function POST(req: Request) {
  const rl = await rateLimit(`booking:${clientIp(req.headers)}`, 6, 60_000);
  if (!rl.ok) return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429, headers: CORS });

  let payload: unknown;
  try { payload = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS }); }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Invalid booking", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 422, headers: CORS });
  }
  const d = parsed.data;

  const db = await getDb();
  const [row] = await db.select().from(siteSettings).where(sql`${siteSettings.key} = 'booking'`).limit(1);
  const cfg = mergeBooking(row?.value);

  if (!cfg.types.includes(d.type)) {
    return Response.json({ error: "That meeting type isn't available." }, { status: 422, headers: CORS });
  }
  const booked = await loadBooked();
  if (!slotIsOpen(cfg, booked, d.date, d.time)) {
    return Response.json({ error: "That slot was just taken — please pick another." }, { status: 409, headers: CORS });
  }

  const channel = d.utmSource ? d.utmSource.charAt(0).toUpperCase() + d.utmSource.slice(1)
    : d.gclid ? "Paid search" : d.fbclid ? "Paid social" : "Direct";
  const meetingLink = d.type === "online" ? `https://meet.jit.si/turnkii-${randomBytes(9).toString("hex")}` : null;
  const bookingToken = randomBytes(18).toString("hex");

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(requests);
  const ref = `TK-${2400 + n}`;
  const now = new Date();

  const [created] = await db
    .insert(requests)
    .values({
      ref,
      contactName: d.name,
      phone: d.phone,
      email: d.email || null,
      propertyType: d.propertyType || null,
      location: d.location || null,
      services: d.services ?? [],
      message: d.message || null,
      kind: "brief",
      status: "survey_booked",
      source: "website",
      channel,
      utmSource: d.utmSource || null,
      utmMedium: d.utmMedium || null,
      utmCampaign: d.utmCampaign || null,
      gclid: d.gclid || null,
      fbclid: d.fbclid || null,
      visitDay: d.date,
      visitSlot: d.time,
      visitType: d.type,
      meetingLink,
      bookingToken,
      firstResponseAt: now,
    })
    .returning();

  await logActivity(null, "booking.create", "request", created.id, { date: d.date, time: d.time, type: d.type });
  await notifyRoles(["ops_manager", "admin"], {
    type: "booking.new",
    title: `New ${d.type === "online" ? "online meeting" : "site survey"} booked: ${ref}`,
    body: `${d.name} · ${d.date} ${d.time}`,
    entity: "request",
    entityId: created.id,
    href: `/requests/${created.id}`,
  });

  after(async () => {
    try {
      await dispatchBookingEmails({
        requestId: created.id, ref, name: d.name, email: d.email || null, phone: d.phone,
        date: d.date, time: d.time, type: d.type, meetingLink, location: d.location || null, bookingToken,
      });
    } catch (e) { console.error("[booking] email dispatch failed", e); }
  });

  return Response.json({ ok: true, ref, meetingLink }, { status: 201, headers: CORS });
}
