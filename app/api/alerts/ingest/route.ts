import { alertOps } from "@/lib/alerts";

// Receives operational alerts from sibling systems (e.g. the FLPP app, which has
// no mailbox of its own) and relays them to the ops/admin team over the admin's
// email setup. Bearer-authenticated with the same token as the FLPP event feed.
function authed(req: Request): boolean {
  const token = process.env.FLPP_API_TOKEN;
  return !!token && req.headers.get("authorization") === `Bearer ${token}`;
}

const s = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

export async function POST(req: Request) {
  if (!authed(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let b: { subject?: unknown; heading?: unknown; intro?: unknown; rows?: unknown; href?: unknown; hrefLabel?: unknown } = {};
  try { b = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }

  const subject = s(b.subject, 200);
  const heading = s(b.heading, 200);
  if (!subject || !heading) return Response.json({ error: "subject and heading required" }, { status: 400 });

  const rows = Array.isArray(b.rows)
    ? b.rows.filter((r): r is [string, string] => Array.isArray(r) && r.length === 2)
        .slice(0, 12).map(([k, v]) => [String(k).slice(0, 60), String(v).slice(0, 2000)] as [string, string])
    : undefined;

  await alertOps({ subject, heading, intro: s(b.intro, 500), rows, href: s(b.href, 500), hrefLabel: s(b.hrefLabel, 60) });
  return Response.json({ ok: true });
}
