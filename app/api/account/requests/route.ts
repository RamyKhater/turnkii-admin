import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requests } from "@/lib/db/schema";
import { getOwnerFromToken } from "@/lib/owner/session";
import { ACCOUNT_CORS, jsonCors, bearer } from "@/lib/account/http";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: ACCOUNT_CORS });
}

/** The signed-in owner's briefs / pre-approvals / bookings, newest first. */
export async function GET(req: Request) {
  const owner = await getOwnerFromToken(bearer(req));
  if (!owner) return jsonCors({ ok: false, error: "Not signed in." }, 401);
  const db = await getDb();
  const rows = await db
    .select({
      ref: requests.ref,
      kind: requests.kind,
      status: requests.status,
      propertyType: requests.propertyType,
      location: requests.location,
      area: requests.area,
      units: requests.units,
      services: requests.services,
      style: requests.style,
      message: requests.message,
      indicativeLimit: requests.indicativeLimit,
      visitDay: requests.visitDay,
      visitSlot: requests.visitSlot,
      meetingLink: requests.meetingLink,
      createdAt: requests.createdAt,
    })
    .from(requests)
    .where(eq(requests.ownerId, owner.id))
    .orderBy(desc(requests.createdAt))
    .limit(50);
  return jsonCors({ ok: true, requests: rows });
}
