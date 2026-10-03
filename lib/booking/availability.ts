import type { BookingConfig } from "./config";

export type DaySlots = { date: string; weekday: number; label: string; slots: string[] };

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Current wall-clock in a timezone, as plain parts (no offset math). */
function nowParts(tz: string): { y: number; m: number; d: number; hh: number; mm: number } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(new Date())) if (part.type !== "literal") p[part.type] = part.value;
  return { y: +p.year, m: +p.month, d: +p.day, hh: +(p.hour === "24" ? "0" : p.hour), mm: +p.minute };
}

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/**
 * Open slots for the next `daysAhead` days. Compares wall-clock to wall-clock in
 * the configured timezone (via a UTC reference built from local parts), so it is
 * DST-agnostic for ordering/lead-time. `booked` maps "YYYY-MM-DD HH:MM" → count.
 */
export function openSlots(cfg: BookingConfig, booked: Record<string, number> = {}): DaySlots[] {
  const np = nowParts(cfg.tz);
  const nowRef = Date.UTC(np.y, np.m - 1, np.d, np.hh, np.mm);
  const leadRef = nowRef + cfg.leadHours * 60 * 60 * 1000;

  const [sh, sm] = cfg.start.split(":").map(Number);
  const [eh, em] = cfg.end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  const out: DaySlots[] = [];
  for (let i = 0; i < cfg.daysAhead; i++) {
    // Walk forward from today's Cairo date using a UTC anchor (date-only).
    const anchor = new Date(Date.UTC(np.y, np.m - 1, np.d));
    anchor.setUTCDate(anchor.getUTCDate() + i);
    const y = anchor.getUTCFullYear(), m = anchor.getUTCMonth() + 1, d = anchor.getUTCDate();
    const weekday = anchor.getUTCDay();
    const date = toKey(y, m, d);
    if (!cfg.days.includes(weekday)) continue;
    if (cfg.blackout.includes(date)) continue;

    const slots: string[] = [];
    for (let t = startMin; t + cfg.slotMinutes <= endMin; t += cfg.slotMinutes) {
      const hh = Math.floor(t / 60), mm = t % 60;
      const time = `${pad(hh)}:${pad(mm)}`;
      const slotRef = Date.UTC(y, m - 1, d, hh, mm);
      if (slotRef < leadRef) continue;                       // too soon / in the past
      if ((booked[`${date} ${time}`] ?? 0) >= cfg.perSlot) continue; // full
      slots.push(time);
    }
    if (slots.length) out.push({ date, weekday, label: WD[weekday], slots });
  }
  return out;
}

/** Is a specific day+time still open under the config + current bookings? */
export function slotIsOpen(cfg: BookingConfig, booked: Record<string, number>, date: string, time: string): boolean {
  return openSlots(cfg, booked).some((d) => d.date === date && d.slots.includes(time));
}
