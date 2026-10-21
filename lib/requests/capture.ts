import { getDb } from "@/lib/db";
import { failedSubmissions } from "@/lib/db/schema";
import { notifyRoles } from "@/lib/notifications";
import { alertOps } from "@/lib/alerts";

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
    const phone = pick(payload, ["phone"]);
    const summary = [name, phone, pick(payload, ["location"])].filter(Boolean).join(" · ") || `via ${route}`;
    try {
      await notifyRoles(["ops_manager", "admin"], {
        type: "lead.capture_failed",
        title: "⚠ A lead could not be saved — recover it",
        body: summary,
        entity: "failed_submission", entityId: row.id, href: `/requests/recovery`,
      });
    } catch { /* in-app alert is best-effort */ }
    // Email the team too, so they're alerted even when not logged in.
    await alertOps({
      subject: "⚠ Turnkii: a lead could not be saved",
      heading: "A lead was captured for recovery",
      intro: "A website submission failed to save as a request. Its details are held so you can recover it — nothing was lost.",
      rows: [["Contact", name || "—"], ["Phone", phone || "—"], ["Email", pick(payload, ["email"]) || "—"], ["Via", route]],
      href: "/requests/recovery", hrefLabel: "Review & recover",
    });
    return row.id;
  } catch (e) {
    // Last resort: if we cannot even dead-letter, log the whole payload so it is
    // at least retrievable from the platform logs.
    console.error("[capture] FAILED to dead-letter a lead", route, JSON.stringify(payload), e);
    return null;
  }
}
