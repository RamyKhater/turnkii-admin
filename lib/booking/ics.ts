// Minimal .ics (iCalendar) builder for a booked meeting. Uses a named TZID
// (Africa/Cairo) with local wall-clock times — Google, Apple and Outlook resolve
// named zones, so we avoid any offset/DST math.

const pad = (n: number) => String(n).padStart(2, "0");

function fold(line: string): string {
  // RFC 5545: fold lines longer than 75 octets.
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let s = line;
  parts.push(s.slice(0, 75));
  s = s.slice(75);
  while (s.length) { parts.push(" " + s.slice(0, 74)); s = s.slice(74); }
  return parts.join("\r\n");
}

const escape = (s: string) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function buildIcs(opts: {
  uid: string;
  tz: string;              // e.g. Africa/Cairo
  date: string;            // YYYY-MM-DD
  time: string;            // HH:MM
  durationMin: number;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
}): string {
  const [y, m, d] = opts.date.split("-").map(Number);
  const [hh, mm] = opts.time.split(":").map(Number);
  const startLocal = `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
  const endMin = hh * 60 + mm + opts.durationMin;
  const eh = Math.floor(endMin / 60) % 24, emm = endMin % 60;
  const endLocal = `${y}${pad(m)}${pad(d)}T${pad(eh)}${pad(emm)}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Turnkii//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${opts.tz}:${startLocal}`,
    `DTEND;TZID=${opts.tz}:${endLocal}`,
    `SUMMARY:${escape(opts.summary)}`,
    opts.description ? `DESCRIPTION:${escape(opts.description)}` : "",
    opts.location ? `LOCATION:${escape(opts.location)}` : "",
    opts.url ? `URL:${escape(opts.url)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
}
