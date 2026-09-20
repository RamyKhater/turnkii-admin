import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { scopeOfWork } from "@/lib/db/schema";

// Public, token-gated: the marketing site's hidden /sow page fetches a customer
// Scope of Work by its unguessable token. No auth — the token IS the credential.
// CORS-open so the static site (a different origin) can read it. Only client-facing
// document fields ever leave the server (never internal ids/refs).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 24) {
    return Response.json({ error: "not found" }, { status: 404, headers: CORS });
  }

  const db = await getDb();
  const [row] = await db.select().from(scopeOfWork).where(eq(scopeOfWork.token, token)).limit(1);
  if (!row) return Response.json({ error: "not found" }, { status: 404, headers: CORS });

  // Only accepted documents are customer-visible. While a SoW is still in
  // review or has changes requested, the token exists but the document is not
  // yet published to the customer — behave as not-found.
  if (row.status !== "shared" && row.status !== "viewed") {
    return Response.json({ error: "not found" }, { status: 404, headers: CORS });
  }

  // Mark viewed on first open (best-effort; never blocks the response).
  if (row.status !== "viewed") {
    try {
      await db.update(scopeOfWork).set({ status: "viewed" }).where(eq(scopeOfWork.token, token));
    } catch {
      /* ignore */
    }
  }

  // The stored `data` is already the client-facing SoW document shape flpp built
  // (summary, areas, inclusions, …). Expose it plus the doc ref; nothing internal.
  const data = (row.data ?? {}) as Record<string, unknown>;
  return Response.json({ docRef: row.docRef, ...data }, { headers: CORS });
}
