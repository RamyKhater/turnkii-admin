import { and, isNotNull, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requests, surveyFiles, requestNotes } from "@/lib/db/schema";

// Read-only survey handoff for flpp. Returns requests whose survey outcome has
// been shared with flpp (`flppSharedAt` set) — the request identity + survey
// files (photos/documents, public Blob URLs) + survey notes — so flpp can
// AI-draft the Scope of Work. Token-authenticated (same guard as other
// /api/flpp/* routes). Never writes; no cost/pricing detail crosses the boundary.
function authed(req: Request): boolean {
  const token = process.env.FLPP_API_TOKEN || "dev-shared-token";
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export async function GET(req: Request) {
  if (!authed(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = await getDb();
  const shared = await db
    .select({
      id: requests.id,
      ref: requests.ref,
      contactName: requests.contactName,
      propertyType: requests.propertyType,
      area: requests.area,
      location: requests.location,
      services: requests.services,
    })
    .from(requests)
    .where(isNotNull(requests.flppSharedAt));

  if (shared.length === 0) return Response.json({ count: 0, surveys: [] });

  const ids = shared.map((r) => r.id);
  const files = await db
    .select({ requestId: surveyFiles.requestId, kind: surveyFiles.kind, url: surveyFiles.url, name: surveyFiles.name, note: surveyFiles.note })
    .from(surveyFiles)
    .where(inArray(surveyFiles.requestId, ids));
  const notes = await db
    .select({ requestId: requestNotes.requestId, kind: requestNotes.kind, body: requestNotes.body })
    .from(requestNotes)
    .where(and(inArray(requestNotes.requestId, ids), inArray(requestNotes.kind, ["survey", "note"])));

  const surveys = shared.map((r) => ({
    requestRef: r.ref,
    client: r.contactName ?? "Client",
    unit: [r.propertyType, r.location].filter(Boolean).join(" · ") || "Property",
    area: r.area ? `${r.area} m²` : undefined,
    services: r.services ?? [],
    notes: notes.filter((n) => n.requestId === r.id).map((n) => ({ kind: n.kind, body: n.body })),
    files: files.filter((f) => f.requestId === r.id).map((f) => ({ kind: f.kind, url: f.url, name: f.name, note: f.note })),
  }));

  return Response.json({ count: surveys.length, surveys });
}
