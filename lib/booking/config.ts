// Meeting-availability config. Stored in site_settings under key "booking" and
// edited in Settings → Meeting availability. The public /api/booking/availability
// computes open slots from it; /api/booking validates against it.

export type VisitType = "online" | "site";

export type BookingConfig = {
  days: number[];        // working weekdays, 0=Sun … 6=Sat
  start: string;         // daily window start, "HH:MM" (Cairo wall time)
  end: string;           // daily window end, "HH:MM"
  slotMinutes: number;   // slot length / step
  leadHours: number;     // minimum notice before a slot can be booked
  daysAhead: number;     // how far ahead booking is open
  perSlot: number;       // max bookings per slot
  blackout: string[];    // blocked dates, "YYYY-MM-DD"
  types: VisitType[];    // which visit types are offered
  tz: string;            // IANA timezone for the wall-clock times
};

// Egypt default: Sun–Thu, 10:00–18:00, 45-min slots, 24h notice, 14 days ahead.
export const BOOKING_DEFAULT: BookingConfig = {
  days: [0, 1, 2, 3, 4],
  start: "10:00",
  end: "18:00",
  slotMinutes: 45,
  leadHours: 24,
  daysAhead: 14,
  perSlot: 1,
  blackout: [],
  types: ["online", "site"],
  tz: "Africa/Cairo",
};

const isTime = (s: unknown): s is string => typeof s === "string" && /^\d{1,2}:\d{2}$/.test(s);

/** Merge a stored (partial, untrusted) config over the defaults, sanitised. */
export function mergeBooking(over: unknown): BookingConfig {
  const o = (over && typeof over === "object" ? over : {}) as Record<string, unknown>;
  const num = (v: unknown, d: number, min: number, max: number) => {
    const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
  };
  const days = Array.isArray(o.days) ? o.days.map(Number).filter((d) => d >= 0 && d <= 6) : BOOKING_DEFAULT.days;
  const types = Array.isArray(o.types) ? (o.types.filter((t) => t === "online" || t === "site") as VisitType[]) : BOOKING_DEFAULT.types;
  const blackout = Array.isArray(o.blackout) ? o.blackout.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
  return {
    days: days.length ? Array.from(new Set(days)).sort() : BOOKING_DEFAULT.days,
    start: isTime(o.start) ? o.start : BOOKING_DEFAULT.start,
    end: isTime(o.end) ? o.end : BOOKING_DEFAULT.end,
    slotMinutes: num(o.slotMinutes, BOOKING_DEFAULT.slotMinutes, 15, 240),
    leadHours: num(o.leadHours, BOOKING_DEFAULT.leadHours, 0, 720),
    daysAhead: num(o.daysAhead, BOOKING_DEFAULT.daysAhead, 1, 90),
    perSlot: num(o.perSlot, BOOKING_DEFAULT.perSlot, 1, 50),
    blackout,
    types: types.length ? types : BOOKING_DEFAULT.types,
    tz: typeof o.tz === "string" && o.tz ? o.tz : BOOKING_DEFAULT.tz,
  };
}
