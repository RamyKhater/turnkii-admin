import { and, eq, isNotNull, ne, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requests, siteSettings } from "@/lib/db/schema";
import { mergeBooking } from "@/lib/booking/config";
import { slotIsOpen } from "@/lib/booking/availability";
import { logActivity } from "@/lib/activity";
import { notifyRoles } from "@/lib/notifications";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// Public but tokened: the customer's reschedule/cancel link on the marketing site
// calls this with the booking_token from their confirmation email.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function loadBooked(excludeId?: number): Promise<Record<string, number>> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({ id: requests.id, day: requests.visitDay, slot: requests.visitSlot })
    .from(requests)
    .where(and(isNotNull(requests.visitDay), ne(requests.status, "lost"), gte(requests.visitDay, today)));
  const map: Record<string, number> = {};
  for (const r of rows) { if (r.id === excludeId || !r.day || !r.slot) continue; const k = `${r.day} ${r.slot}`; map[k] = (map[k] ?? 0) + 1; }
  return map;
}

function validToken(t: string | null): t is string { return !!t && /^[a-f0-9]{24,48}$/i.test(t); }

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!validToken(token)) return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
  const db = await getDb();
  const [row] = await db.select().from(requests).where(eq(requests.bookingToken, token)).limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404, headers: CORS });
  const cancelled = row.status === "lost";
  return Response.json(
    {
      ref: row.ref, name: row.contactName, date: row.visitDay, time: row.visitSlot,
      type: row.visitType, meetingLink: row.meetingLink, location: row.location, cancelled,
    },
    { status: 200, headers: CORS },
  );
}

const postSchema = z.object({
  token: z.string(),
  action: z.enum(["cancel", "reschedule"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
});

export async function POST(req: Request) {
  const rl = await rateLimit(`manage:${clientIp(req.headers)}`, 10, 60_000);
  if (!rl.ok) return Response.json({ error: "Too many requests" }, { status: 429, headers: CORS });

  let payload: unknown;
  try { payload = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS }); }
  const parsed = postSchema.safeParse(payload);
  if (!parsed.success || !validToken(parsed.data.token)) return Response.json({ error: "Invalid request" }, { status: 422, headers: CORS });
  const { token, action, date, time } = parsed.data;

  const db = await getDb();
  const [row] = await db.select().from(requests).where(eq(requests.bookingToken, token)).limit(1);
  if (!row) return Response.json({ error: "Not found" }, { status: 404, headers: CORS });

  if (action === "cancel") {
    await db.update(requests).set({ status: "lost", updatedAt: new Date() }).where(eq(requests.id, row.id));
    await logActivity(null, "booking.cancel", "request", row.id);
    await notifyRoles(["ops_manager", "admin"], {
      type: "booking.cancel", title: `Meeting cancelled by customer: ${row.ref}`,
      body: `${row.contactName ?? ""} · ${row.visitDay} ${row.visitSlot}`, entity: "request", entityId: row.id, href: `/requests/${row.id}`,
    });
    return Response.json({ ok: true, cancelled: true }, { status: 200, headers: CORS });
  }

  // reschedule
  if (!date || !time) return Response.json({ error: "Pick a new time." }, { status: 422, headers: CORS });
  const [cfgRow] = await db.select().from(siteSettings).where(sql`${siteSettings.key} = 'booking'`).limit(1);
  const cfg = mergeBooking(cfgRow?.value);
  const booked = await loadBooked(row.id);
  if (!slotIsOpen(cfg, booked, date, time)) return Response.json({ error: "That slot isn’t available — pick another." }, { status: 409, headers: CORS });

  await db.update(requests).set({ visitDay: date, visitSlot: time, status: "survey_booked", remindedAt: null, updatedAt: new Date() }).where(eq(requests.id, row.id));
  await logActivity(null, "booking.reschedule", "request", row.id, { from: `${row.visitDay} ${row.visitSlot}`, to: `${date} ${time}` });
  await notifyRoles(["ops_manager", "admin"], {
    type: "booking.reschedule", title: `Meeting rescheduled by customer: ${row.ref}`,
    body: `${row.contactName ?? ""} → ${date} ${time}`, entity: "request", entityId: row.id, href: `/requests/${row.id}`,
  });
  return Response.json({ ok: true, date, time }, { status: 200, headers: CORS });
}
