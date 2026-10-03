import { and, isNotNull, ne, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requests, siteSettings } from "@/lib/db/schema";
import { mergeBooking } from "@/lib/booking/config";
import { openSlots } from "@/lib/booking/availability";

// Public: the marketing site reads this to render only genuinely-open slots.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** Count current bookings per "YYYY-MM-DD HH:MM" from non-cancelled requests. */
async function loadBooked(): Promise<Record<string, number>> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({ day: requests.visitDay, slot: requests.visitSlot })
    .from(requests)
    .where(and(isNotNull(requests.visitDay), ne(requests.status, "lost"), gte(requests.visitDay, today)));
  const map: Record<string, number> = {};
  for (const r of rows) {
    if (!r.day || !r.slot) continue;
    const k = `${r.day} ${r.slot}`;
    map[k] = (map[k] ?? 0) + 1;
  }
  return map;
}

export async function GET() {
  const db = await getDb();
  const [row] = await db.select().from(siteSettings).where(sql`${siteSettings.key} = 'booking'`).limit(1);
  const cfg = mergeBooking(row?.value);
  const booked = await loadBooked();
  const days = openSlots(cfg, booked);
  return Response.json(
    { tz: cfg.tz, types: cfg.types, slotMinutes: cfg.slotMinutes, days },
    { status: 200, headers: { ...CORS, "Cache-Control": "public, max-age=60" } },
  );
}
