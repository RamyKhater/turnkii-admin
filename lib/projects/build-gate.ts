import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { emitToFlpp } from "@/lib/flpp/emit";

// Stages at or past design lock — the FLPP side has locked scope.
const LOCKED_STAGES = new Set(["scope_locked", "in_execution", "certifying", "handover", "complete"]);

/**
 * F1 — the "cleared to build" gate. The gate turns green only when BOTH facts
 * hold on a project: the customer-facing SoW was accepted (sowApprovedAt) and
 * FLPP reported scope.locked (stage at/past lock). When both are first true we
 * stamp buildClearedAt once and push build.cleared to FLPP, which holds its own
 * procurement (startDelivery) until that arrives. Safe to call from either side
 * of the race (SoW accept, or scope.locked ingest) — idempotent.
 */
export async function maybeClearBuild(
  db: Awaited<ReturnType<typeof getDb>>,
  projectId: number,
): Promise<boolean> {
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return false;
  if (p.buildClearedAt) return true; // already cleared
  const ready = !!p.sowApprovedAt && LOCKED_STAGES.has(p.stage);
  if (!ready) return false;
  await db.update(projects).set({ buildClearedAt: new Date(), updatedAt: new Date() }).where(eq(projects.id, projectId));
  // Fact, not a command — FLPP chooses to gate RFQ/delivery on it.
  await emitToFlpp("build.cleared", p.flppTicketRef ?? null, {
    requestRef: p.requestRef ?? undefined,
    projectId: p.id,
  });
  return true;
}
