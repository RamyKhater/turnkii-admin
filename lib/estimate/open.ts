import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { estimates, requests } from "@/lib/db/schema";
import { logActivity } from "@/lib/activity";
import { notifyRoles } from "@/lib/notifications";
import { emitToFlpp } from "@/lib/flpp/emit";
import { getEstimateConfig } from "@/lib/estimate/store";
import { autoCost, type EstimateBrief } from "@/lib/estimate/engine";

const SLA_HOURS = 24;

/** Open a costed estimate for a request: snapshot the brief, auto-cost it, start
 *  a 24h SLA from the client's original submission, and push estimate.requested
 *  to FLPP. Idempotent (one estimate per request). No capability check — callers
 *  authorize (the ops action asserts a cap; the public intake calls it only for
 *  an estimate submission it just created). */
export async function openEstimateForRequest(requestId: number, actorId: number | null = null): Promise<{ error?: string; ref?: string }> {
  const db = await getDb();
  const [r] = await db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  if (!r) return { error: "Request not found." };
  const [existing] = await db.select({ ref: estimates.ref }).from(estimates).where(eq(estimates.requestId, requestId)).limit(1);
  if (existing) return { ref: existing.ref };

  const brief: EstimateBrief = {
    propertyType: r.propertyType, area: r.area, units: r.units, services: r.services ?? [],
    style: r.style, package: r.pkg, budgetPlan: r.budgetPlan, materials: r.materials ?? [],
  };
  const { rates } = await getEstimateConfig();
  const ac = autoCost(brief, rates);
  const slaDueAt = new Date(r.createdAt.getTime() + SLA_HOURS * 3600_000);

  const [{ maxn }] = await db.select({ maxn: sql<number>`coalesce(max(split_part(ref, '-', 2)::int), 1000)` }).from(estimates);
  let seq = Math.max(1001, Number(maxn ?? 1000) + 1);
  let row: typeof estimates.$inferSelect | undefined;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      [row] = await db.insert(estimates).values({
        ref: `EST-${seq}`, requestId: r.id, ownerId: r.ownerId ?? null,
        brief: { ...brief, contactName: r.contactName, location: r.location },
        tier: ac.tier, autoQuotation: ac.quotation, autoBreakdown: ac.lines as unknown as Record<string, unknown>[],
        status: "requested", slaDueAt,
      }).returning();
      break;
    } catch (e) {
      const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
      if (code === "23505" && attempt < 19) { seq++; continue; }
      throw e;
    }
  }
  if (!row) return { error: "Could not open the estimate." };

  await emitToFlpp("estimate.requested", null, {
    requestRef: r.ref, estimateRef: row.ref, autoQuotation: ac.quotation, tier: ac.tier,
    brief: { client: r.contactName, unit: r.propertyType, area: ac.area, units: ac.units, services: r.services ?? [], style: r.style },
  });
  await db.update(requests).set({ flppSharedAt: new Date(), updatedAt: new Date() }).where(eq(requests.id, r.id));
  await logActivity(actorId, "estimate.request", "estimate", row.id, { requestId, autoQuotation: ac.quotation });
  await notifyRoles(["ops_manager", "project_manager"], {
    type: "estimate.requested", title: `Estimate requested · ${row.ref}`,
    body: `${r.contactName ?? "Client"} · due ${slaDueAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`,
    entity: "request", entityId: requestId, href: `/requests/${requestId}`,
  });
  return { ref: row.ref };
}
