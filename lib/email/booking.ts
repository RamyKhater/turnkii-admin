import { getDb } from "@/lib/db";
import { users, siteSettings } from "@/lib/db/schema";
import { sendEmail, layout, button, esc, appUrl } from "@/lib/email/send";
import { buildIcs } from "@/lib/booking/ics";
import { mergeBooking } from "@/lib/booking/config";

export type BookingInfo = {
  requestId: number;
  ref: string;
  name: string;
  email: string | null;
  phone: string | null;
  date: string;          // YYYY-MM-DD (Cairo wall time)
  time: string;          // HH:MM
  type: "online" | "site";
  meetingLink: string | null;
  location: string | null;
  bookingToken?: string | null; // powers the reschedule/cancel link
};

const MARKETING_URL = (process.env.MARKETING_URL || "https://turnkii.app").replace(/\/$/, "");
function manageUrl(token?: string | null): string | null {
  return token ? `${MARKETING_URL}/manage-booking?token=${encodeURIComponent(token)}` : null;
}

const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function prettyWhen(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WD[wd]} ${d} ${MO[m - 1]} ${y} · ${time}`;
}

function detailRows(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">` +
    rows.map(([k, v]) =>
      `<tr><td style="padding:6px 0;font-size:13px;color:#8A8A79;width:140px;vertical-align:top;">${esc(k)}</td>` +
      `<td style="padding:6px 0;font-size:14px;color:#12130E;font-weight:600;">${v}</td></tr>`).join("") +
    `</table>`;
}

/** Confirmation to the customer (with .ics) + an alert to admin/ops (with .ics). */
export async function dispatchBookingEmails(info: BookingInfo): Promise<void> {
  const db = await getDb();
  const settings = await db.select().from(siteSettings);
  const cfg = mergeBooking(settings.find((s) => s.key === "booking")?.value);
  const online = info.type === "online";
  const when = prettyWhen(info.date, info.time);
  const typeLabel = online ? "Online meeting" : "On-site survey";

  const ics = buildIcs({
    uid: `turnkii-${info.ref}@turnkii.app`,
    tz: cfg.tz,
    date: info.date,
    time: info.time,
    durationMin: cfg.slotMinutes,
    summary: online ? "Turnkii — online meeting" : "Turnkii — on-site survey",
    description: online && info.meetingLink
      ? `Your Turnkii online meeting (ref ${info.ref}). Join: ${info.meetingLink}`
      : `Your Turnkii on-site survey (ref ${info.ref}). Our team will visit to measure and walk your chosen style.`,
    location: online ? (info.meetingLink ?? "Online") : (info.location ?? "On-site"),
    url: info.meetingLink ?? undefined,
  });
  const icsAttach = {
    filename: "turnkii-meeting.ics",
    content: Buffer.from(ics, "utf8").toString("base64"),
    contentType: "text/calendar; method=PUBLISH",
  };

  // 1) customer confirmation
  if (info.email) {
    const rows: [string, string][] = [
      ["When", `${esc(when)} <span style="color:#8A8A79;font-weight:400;">(Cairo time)</span>`],
      ["Type", esc(typeLabel)],
    ];
    if (online && info.meetingLink) rows.push(["Meeting link", `<a href="${esc(info.meetingLink)}" style="color:#4E5A16;">${esc(info.meetingLink)}</a>`]);
    if (!online && info.location) rows.push(["Location", esc(info.location)]);
    rows.push(["Reference", esc(info.ref)]);

    const mUrl = manageUrl(info.bookingToken);
    const body = detailRows(rows)
      + (online && info.meetingLink ? `<div style="margin:18px 0;">${button("Join the meeting", info.meetingLink)}</div>` : "")
      + `<p style="font-size:14px;color:#5E5F52;line-height:1.6;margin:14px 0 0;">The calendar invite is attached — add it to your calendar in one tap.`
      + (mUrl ? ` Need a different time? <a href="${esc(mUrl)}" style="color:#4E5A16;font-weight:600;">Reschedule or cancel</a>.` : " Need a different time? Just reply to this email.")
      + `</p>`;

    await sendEmail({
      to: info.email,
      subject: `Your Turnkii meeting — ${when}`,
      html: layout({ heading: "Your meeting is booked", intro: `Thanks ${esc(info.name)} — you're all set.`, body, preheader: `Booked: ${when}` }),
      attachments: [icsAttach],
    });
  }

  // 2) alert to admin / ops (+ extra recipients from settings)
  const staff = await db.select({ email: users.email, role: users.role, active: users.active }).from(users);
  const staffEmails = staff.filter((u) => u.active && (u.role === "admin" || u.role === "ops_manager")).map((u) => u.email);
  const extra = String(settings.find((s) => s.key === "notify.extraRecipients")?.value ?? "")
    .split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const to = Array.from(new Set([...staffEmails, ...extra]));
  if (to.length) {
    const rows: [string, string][] = [
      ["Customer", esc(info.name)],
      ["Phone", info.phone ? `<a href="tel:${esc(info.phone)}" style="color:#4E5A16;">${esc(info.phone)}</a>` : "—"],
      ["Email", info.email ? `<a href="mailto:${esc(info.email)}" style="color:#4E5A16;">${esc(info.email)}</a>` : "—"],
      ["When", `${esc(when)} (Cairo)`],
      ["Type", esc(typeLabel)],
    ];
    if (online && info.meetingLink) rows.push(["Meeting link", `<a href="${esc(info.meetingLink)}" style="color:#4E5A16;">${esc(info.meetingLink)}</a>`]);
    if (!online && info.location) rows.push(["Location", esc(info.location)]);

    const body = detailRows(rows) + `<div style="margin:18px 0;">${button("Open in admin", `${appUrl()}/requests/${info.requestId}`)}</div>`;
    await sendEmail({
      to,
      subject: `New ${typeLabel.toLowerCase()} booked — ${info.ref}`,
      html: layout({ heading: "New meeting booked", body, preheader: `${info.name} · ${when}` }),
      replyTo: info.email ?? undefined,
      attachments: [icsAttach],
    });
  }
}

/** A 24h reminder to the customer (with the .ics again + manage link). Sent by
 *  the daily cron for meetings happening tomorrow. */
export async function sendBookingReminder(info: BookingInfo): Promise<void> {
  if (!info.email) return;
  const db = await getDb();
  const settings = await db.select().from(siteSettings);
  const cfg = mergeBooking(settings.find((s) => s.key === "booking")?.value);
  const online = info.type === "online";
  const when = prettyWhen(info.date, info.time);
  const typeLabel = online ? "Online meeting" : "On-site survey";

  const ics = buildIcs({
    uid: `turnkii-${info.ref}@turnkii.app`, tz: cfg.tz, date: info.date, time: info.time, durationMin: cfg.slotMinutes,
    summary: online ? "Turnkii — online meeting" : "Turnkii — on-site survey",
    description: online && info.meetingLink ? `Join: ${info.meetingLink}` : "Your Turnkii on-site survey.",
    location: online ? (info.meetingLink ?? "Online") : (info.location ?? "On-site"), url: info.meetingLink ?? undefined,
  });
  const icsAttach = { filename: "turnkii-meeting.ics", content: Buffer.from(ics, "utf8").toString("base64"), contentType: "text/calendar; method=PUBLISH" };

  const mUrl = manageUrl(info.bookingToken);
  const rows: [string, string][] = [
    ["When", `${esc(when)} <span style="color:#8A8A79;font-weight:400;">(Cairo time)</span>`],
    ["Type", esc(typeLabel)],
  ];
  if (online && info.meetingLink) rows.push(["Meeting link", `<a href="${esc(info.meetingLink)}" style="color:#4E5A16;">${esc(info.meetingLink)}</a>`]);
  if (!online && info.location) rows.push(["Location", esc(info.location)]);

  const body = detailRows(rows)
    + (online && info.meetingLink ? `<div style="margin:18px 0;">${button("Join the meeting", info.meetingLink)}</div>` : "")
    + (mUrl ? `<p style="font-size:14px;color:#5E5F52;line-height:1.6;margin:14px 0 0;">Can’t make it? <a href="${esc(mUrl)}" style="color:#4E5A16;font-weight:600;">Reschedule or cancel</a>.</p>` : "");

  await sendEmail({
    to: info.email,
    subject: `Reminder: your Turnkii meeting tomorrow — ${when}`,
    html: layout({ heading: "See you tomorrow", intro: `Hi ${esc(info.name)} — a quick reminder of your meeting.`, body, preheader: `Tomorrow: ${when}` }),
    attachments: [icsAttach],
  });
}
