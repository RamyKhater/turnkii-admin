import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { scopeOfWork } from "@/lib/db/schema";

// flpp polls this to pull the reviewer's verdict on a shared SoW: the current
// status (in_review | changes_requested | shared | viewed), any review comments,
// and the customer URL once accepted. Token-authenticated (same guard as the
// other /api/flpp/* routes) — distinct from the public /api/sow/[token] the
// marketing site uses. Never writes.
function authed(req: Request): boolean {
  const token = process.env.FLPP_API_TOKEN || "dev-shared-token";
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!authed(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { token } = await params;

  const db = await getDb();
  const [row] = await db.select().from(scopeOfWork).where(eq(scopeOfWork.token, token)).limit(1);
  if (!row) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json({
    status: row.status,
    comments: row.comments ?? [],
    customerUrl: row.customerUrl ?? null,
    docRef: row.docRef,
  });
}
