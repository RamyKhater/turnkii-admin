import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { scopeOfWork } from "@/lib/db/schema";

// Receives a filled Scope of Work from flpp and stores it under its (flpp-minted)
// token so the hidden /sow customer page can fetch it. Token-authenticated
// (same guard as the other /api/flpp/* routes). Idempotent upsert by token.
function authed(req: Request): boolean {
  const token = process.env.FLPP_API_TOKEN || "dev-shared-token";
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export async function POST(req: Request) {
  if (!authed(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    token?: string;
    docRef?: string;
    requestRef?: string | null;
    ticketRef?: string | null;
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
  const existing = await db.select({ id: scopeOfWork.id }).from(scopeOfWork).where(eq(scopeOfWork.token, body.token)).limit(1);
  const values = {
    token: body.token,
    docRef: body.docRef,
    requestRef: body.requestRef ?? null,
    ticketRef: body.ticketRef ?? null,
    data: body.data,
    customerUrl: body.customerUrl ?? null,
    status: "shared" as const,
    updatedAt: new Date(),
  };
  if (existing.length) {
    await db.update(scopeOfWork).set(values).where(eq(scopeOfWork.token, body.token));
  } else {
    await db.insert(scopeOfWork).values(values);
  }

  return Response.json({ ok: true, token: body.token, customerUrl: body.customerUrl ?? null });
}
