import { getDb } from "@/lib/db";
import { failedSubmissions } from "@/lib/db/schema";
import { notifyRoles } from "@/lib/notifications";

type Payload = Record<string, unknown>;
const pick = (p: Payload, keys: string[]): string | null => {
  for (const k of keys) { const v = p[k]; if (typeof v === "string" && v.trim()) return v.trim(); }
  return null;
};

/**
 * Dead-letter a lead that could not be persisted as a request. The raw payload
 * is kept so ops can recover it from the admin, and the team is alerted. Never
 * throws — capture must not fail the caller further. Returns the dead-letter id
 * (or null if even the capture failed, which is then only logged).
 */
export async function captureFailedSubmission(
  route: "intake" | "booking" | "manual",
  payload: Payload,
  error: unknown,
): Promise<number | null> {
  try {
    const db = await getDb();
    const name = pick(payload, ["contactName", "name"]);
    const [row] = await db.insert(failedSubmissions).values({
      route,
      payload,
      error: error instanceof Error ? error.message : String(error),
      contactName: name,
      phone: pick(payload, ["phone"]),
      email: pick(payload, ["email"]),
    }).returning({ id: failedSubmissions.id });
    try {
      await notifyRoles(["ops_manager", "admin"], {
        type: "lead.capture_failed",
        title: "⚠ A lead could not be saved — recover it",
        body: [name, pick(payload, ["phone"]), pick(payload, ["location"])].filter(Boolean).join(" · ") || `via ${route}`,
        entity: "failed_submission", entityId: row.id, href: `/requests/recovery`,
      });
    } catch { /* alert is best-effort */ }
    return row.id;
  } catch (e) {
    // Last resort: if we cannot even dead-letter, log the whole payload so it is
    // at least retrievable from the platform logs.
    console.error("[capture] FAILED to dead-letter a lead", route, JSON.stringify(payload), e);
    return null;
  }
}
