import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requests } from "@/lib/db/schema";

// Read-only origination endpoint for flpp (the execution layer). Returns
// design-approved requests — signed clients ready for execution — shaped to the
// Turnkii × flpp integration contract's `request.design_approved` payload:
// client, property, scope summary, contract value, design pack ref. No
// payment-plan detail crosses the boundary. Token-authenticated; never writes.
function authed(req: Request): boolean {
  const token = process.env.FLPP_API_TOKEN || "dev-shared-token";
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export async function GET(req: Request) {
  if (!authed(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = await getDb();
  // `won` = client signed + design approved → handed to flpp for execution.
  // Select only the columns the boundary needs (keeps this resilient to schema
  // drift and ensures no payment-plan detail is ever read).
  const rows = await db
    .select({
      ref: requests.ref,
      contactName: requests.contactName,
      phone: requests.phone,
      propertyType: requests.propertyType,
      location: requests.location,
      services: requests.services,
      indicativeLimit: requests.indicativeLimit,
    })
    .from(requests)
    .where(eq(requests.status, "won"));

  const requestsOut = rows.map((r) => ({
    ref: r.ref,
    client: r.contactName ?? "Client",
    phone: r.phone ?? "",
    unit: [r.propertyType, r.location].filter(Boolean).join(" · ") || "Property",
    scope: (r.services ?? []).join(", ") || "Full finishing",
    contractValue: r.indicativeLimit ?? 0,
    designPackRef: `DP-${r.ref}`,
  }));

  return Response.json({ stage: "design_approved", count: requestsOut.length, requests: requestsOut });
}
