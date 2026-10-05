import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requests, siteSettings } from "@/lib/db/schema";
import { mergeBooking } from "@/lib/booking/config";
import { sendBookingReminder } from "@/lib/email/booking";

// Daily cron (see vercel.json). Emails a 24h reminder for meetings happening
// "tomorrow" in the booking timezone, once each (reminded_at guard). Secured by
// CRON_SECRET when set — Vercel Cron sends it as `Authorization: Bearer …`.
export const dynamic = "force-dynamic";

function tomorrowInTz(tz: string): string {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(new Date())) if (part.type !== "literal") p[part.type] = part.value;
  const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const [cfgRow] = await db.select().from(siteSettings).where(sql`${siteSettings.key} = 'booking'`).limit(1);
  const cfg = mergeBooking(cfgRow?.value);
  const target = tomorrowInTz(cfg.tz);

  const due = await db
    .select()
    .from(requests)
    .where(and(eq(requests.status, "survey_booked"), eq(requests.visitDay, target), isNull(requests.remindedAt)));

  let sent = 0;
  for (const r of due) {
    if (!r.email || !r.visitSlot || !r.visitType) continue;
    try {
      await sendBookingReminder({
        requestId: r.id, ref: r.ref, name: r.contactName ?? "there", email: r.email, phone: r.phone,
        date: r.visitDay!, time: r.visitSlot, type: r.visitType as "online" | "site",
        meetingLink: r.meetingLink, location: r.location, bookingToken: r.bookingToken,
      });
      await db.update(requests).set({ remindedAt: new Date() }).where(eq(requests.id, r.id));
      sent++;
    } catch (e) {
      console.error("[cron] reminder failed for", r.ref, e);
    }
  }
  return Response.json({ ok: true, date: target, due: due.length, sent });
}
