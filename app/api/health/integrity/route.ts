import { sql, eq, and, lt, notInArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requests, failedSubmissions, estimates } from "@/lib/db/schema";
import { alertOps } from "@/lib/alerts";
import { notifyRoles } from "@/lib/notifications";

// Daily data-integrity health check (see vercel.json crons). Scans the lead
// pipeline for the class of fault that silently drops leads — duplicate/
// colliding references and un-recovered captures — and, if anything is wrong,
// emails the team + raises an in-app alert. Reads only; safe to call anytime.
// Secured by CRON_SECRET when set (Vercel Cron sends it as `Authorization: Bearer`).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const issues: string[] = [];

  // 1. Duplicate references actually in use (a past collision that slipped through).
  const dupRows = await db
    .select({ ref: requests.ref, c: sql<number>`count(*)::int` })
    .from(requests)
    .groupBy(requests.ref)
    .having(sql`count(*) > 1`);
  if (dupRows.length) issues.push(`Duplicate references in use: ${dupRows.map((d) => `${d.ref}×${d.c}`).join(", ")}`);

  // 2. The next collision-proof reference must be free (allocator sanity).
  const [{ maxn }] = await db
    .select({ maxn: sql<number>`coalesce(max(split_part(ref,'-',2)::int), 2399)` })
    .from(requests);
  const next = Math.max(2400, Number(maxn ?? 2399) + 1);
  const taken = await db.select({ one: sql`1` }).from(requests).where(eq(requests.ref, `TK-${next}`)).limit(1);
  if (taken.length) issues.push(`Next reference TK-${next} is already taken — allocator assumption broken.`);

  // 3. Leads captured but not yet recovered.
  const [{ pending }] = await db.select({ pending: sql<number>`count(*)::int` }).from(failedSubmissions).where(sql`status = 'pending'`);
  const pendingN = Number(pending ?? 0);
  if (pendingN > 0) issues.push(`${pendingN} lead(s) captured but not yet recovered.`);

  // 4. Estimate requests breaching the 24h answer SLA (not yet published).
  const slaBreached = await db.select({ ref: estimates.ref }).from(estimates)
    .where(and(lt(estimates.slaDueAt, new Date()), notInArray(estimates.status, ["published", "declined"])));
  if (slaBreached.length) issues.push(`${slaBreached.length} estimate(s) past the 24h SLA, not yet published: ${slaBreached.map((e) => e.ref).join(", ")}`);

  const healthy = issues.length === 0;
  if (!healthy) {
    await alertOps({
      subject: `⚠ Turnkii data-integrity check found ${issues.length} issue(s)`,
      heading: "Data-integrity check needs attention",
      intro: "The daily lead-pipeline scan found something worth a look.",
      rows: issues.map((t, i) => [`Issue ${i + 1}`, t] as [string, string]),
      href: "/requests/recovery", hrefLabel: "Open admin",
    });
    try {
      await notifyRoles(["ops_manager", "admin"], {
        type: "health.integrity",
        title: `⚠ Data-integrity: ${issues.length} issue(s)`,
        body: issues[0], entity: "health", href: "/requests/recovery",
      });
    } catch { /* best-effort */ }
  }

  return Response.json({ healthy, issues, checkedAt: new Date().toISOString(), nextRef: `TK-${next}`, pendingCaptures: pendingN });
}
