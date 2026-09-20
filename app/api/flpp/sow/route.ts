import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { scopeOfWork } from "@/lib/db/schema";

// Receives an AI-drafted Scope of Work shared from flpp for review. Stored under
// its (flpp-minted) token; a reviewer here Accepts (→ status `shared`, customer
// /sow page live) or Requests edit. Re-shares after revision upsert by token.
// Token-authenticated (same guard as the other /api/flpp/* routes). The reviewer
// state (status transitions to shared/changes_requested, comments) is owned here
// — a re-share never regresses an accepted doc or drops review comments.
function authed(req: Request): boolean {
  const token = process.env.FLPP_API_TOKEN || "dev-shared-token";
  return req.headers.get("authorization") === `Bearer ${token}`;
}

const INBOUND = new Set(["in_review", "changes_requested", "shared", "viewed"]);

export async function POST(req: Request) {
  if (!authed(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    token?: string;
    docRef?: string;
    requestRef?: string | null;
    ticketRef?: string | null;
    status?: string;
    data?: Record<string, unknown>;
    customerUrl?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.token || !body.docRef || !body.data) {
    return Response.json({ error: "token, docRef and data are required" }, { status: 400 });
  }

  const db = await getDb();
  const [existing] = await db.select().from(scopeOfWork).where(eq(scopeOfWork.token, body.token)).limit(1);
  // flpp shares as `in_review`; ignore any other inbound status. Never let a
  // re-share regress an already-accepted (shared/viewed) document.
  const inbound = body.status && INBOUND.has(body.status) ? body.status : "in_review";
  const status = existing && (existing.status === "shared" || existing.status === "viewed")
    ? existing.status
    : inbound;

  if (existing) {
    await db.update(scopeOfWork).set({
      docRef: body.docRef,
      requestRef: body.requestRef ?? existing.requestRef,
      ticketRef: body.ticketRef ?? existing.ticketRef,
      data: body.data,
      customerUrl: body.customerUrl ?? existing.customerUrl,
      status,
      updatedAt: new Date(),
    }).where(eq(scopeOfWork.token, body.token));
  } else {
    await db.insert(scopeOfWork).values({
      token: body.token,
      docRef: body.docRef,
      requestRef: body.requestRef ?? null,
      ticketRef: body.ticketRef ?? null,
      data: body.data,
      customerUrl: body.customerUrl ?? null,
      status,
    });
  }

  return Response.json({ ok: true, token: body.token, status, customerUrl: body.customerUrl ?? existing?.customerUrl ?? null });
}
