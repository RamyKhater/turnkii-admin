"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { failedSubmissions, requests } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";
import { insertRequest, type RequestPrefix } from "@/lib/requests/ref";

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const int = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; };
const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/**
 * Recover a dead-lettered lead into a real request. Reconstructs the request
 * from the captured payload (same field mapping as intake) and allocates a
 * fresh ref via the shared, collision-proof path. Idempotent per row.
 */
export async function recoverSubmission(id: number): Promise<{ error?: string; ref?: string }> {
  const user = await assertCap("requests:create");
  const db = await getDb();
  const [f] = await db.select().from(failedSubmissions).where(eq(failedSubmissions.id, id)).limit(1);
  if (!f) return { error: "Not found." };
  if (f.status !== "pending") return { error: "Already handled." };

  const p = f.payload ?? {};
  const kindRaw = str(p.kind);
  const kind = (["brief", "financing", "service", "project"].includes(kindRaw ?? "") ? kindRaw : "brief") as string;
  const prefix: RequestPrefix = kind === "financing" ? "TF" : kind === "service" ? "TS" : kind === "project" ? "TP" : "TK";

  let row;
  try {
    row = await insertRequest(db, prefix, {
      contactName: str(p.contactName) ?? str(p.name) ?? "Recovered lead",
      phone: str(p.phone) ?? "",
      email: str(p.email),
      propertyType: str(p.propertyType),
      area: int(p.area) ?? undefined,
      units: int(p.units) ?? undefined,
      location: str(p.location),
      services: arr(p.services),
      style: str(p.style) ?? undefined,
      budgetPlan: str(p.budgetPlan) ?? undefined,
      materials: arr(p.materials),
      pkg: str(p.package) ?? undefined,
      timeline: str(p.timeline) ?? undefined,
      kind,
      monthlyIncome: int(p.monthlyIncome) ?? undefined,
      financeAmount: int(p.financeAmount) ?? undefined,
      employment: str(p.employment) ?? undefined,
      channel: str(p.channel) ?? "Recovered",
      message: str(p.message) ?? str(p.notes),
      status: "new",
      source: f.route === "manual" ? "manual" : "website",
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the request." };
  }

  await db.update(failedSubmissions).set({
    status: "recovered", recoveredRequestId: row.id, handledBy: user.id, handledAt: new Date(),
  }).where(eq(failedSubmissions.id, id));
  await logActivity(user.id, "lead.recovered", "request", row.id, { from: "failed_submission", failedId: id });
  revalidatePath("/requests/recovery");
  revalidatePath("/requests");
  return { ref: row.ref };
}

/** Dismiss a dead-lettered lead (spam or duplicate) without creating a request. */
export async function dismissSubmission(id: number): Promise<{ error?: string }> {
  const user = await assertCap("requests:create");
  const db = await getDb();
  const [f] = await db.select().from(failedSubmissions).where(eq(failedSubmissions.id, id)).limit(1);
  if (!f) return { error: "Not found." };
  if (f.status !== "pending") return { error: "Already handled." };
  await db.update(failedSubmissions).set({ status: "dismissed", handledBy: user.id, handledAt: new Date() }).where(eq(failedSubmissions.id, id));
  await logActivity(user.id, "lead.dismissed", "failed_submission", id);
  revalidatePath("/requests/recovery");
  return {};
}
