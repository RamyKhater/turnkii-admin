import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { projects, requests, surveyFiles } from "@/lib/db/schema";

/**
 * Idempotently create (or fetch) the project hub for a request. Links the
 * project to its request by id + ref (the ref is FLPP's origination_ref, so the
 * project can later bind to the FLPP ticket) and carries the survey files over.
 * Plain helper — not a server action — so it carries no capability of its own
 * and can be called from any flow that has already authorised the caller.
 */
export async function ensureProjectForRequest(
  requestId: number,
): Promise<{ id: number; created: boolean; name: string }> {
  const db = await getDb();
  const [existing] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.requestId, requestId))
    .limit(1);
  if (existing) return { id: existing.id, created: false, name: existing.name };

  const [req] = await db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  if (!req) throw new Error("Request not found");

  const name = [req.contactName || "Project", req.propertyType || req.location || "fit-out"]
    .filter(Boolean)
    .join(" — ");
  const [row] = await db
    .insert(projects)
    .values({
      name,
      requestId,
      requestRef: req.ref,
      ownerId: req.ownerId ?? null,
      ownerName: req.contactName,
      ownerPhone: req.phone,
      ownerEmail: req.email,
      style: req.style,
      services: Array.isArray(req.services) ? req.services : [],
      contractValue: req.indicativeLimit ?? req.financeAmount ?? 0,
      status: "active",
      stage: "won",
      startDate: new Date(),
    })
    .returning();

  await db.update(surveyFiles).set({ projectId: row.id }).where(eq(surveyFiles.requestId, requestId));
  return { id: row.id, created: true, name };
}
