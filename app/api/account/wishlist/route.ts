import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { wishlistItems } from "@/lib/db/schema";
import { getOwnerFromToken } from "@/lib/owner/session";
import { ACCOUNT_CORS, jsonCors, bearer } from "@/lib/account/http";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: ACCOUNT_CORS });
}

export async function GET(req: Request) {
  const owner = await getOwnerFromToken(bearer(req));
  if (!owner) return jsonCors({ ok: false, error: "Not signed in." }, 401);
  const db = await getDb();
  const items = await db
    .select()
    .from(wishlistItems)
    .where(eq(wishlistItems.ownerId, owner.id))
    .orderBy(desc(wishlistItems.createdAt));
  return jsonCors({ ok: true, items });
}

const addSchema = z.object({
  kind: z.enum(["style", "inspiration", "product"]),
  ref: z.string().trim().min(1).max(120),
  label: z.string().trim().max(160).optional(),
});
const removeSchema = z.object({ remove: z.literal(true), id: z.coerce.number().int().positive() });

export async function POST(req: Request) {
  const owner = await getOwnerFromToken(bearer(req));
  if (!owner) return jsonCors({ ok: false, error: "Not signed in." }, 401);
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const db = await getDb();

  const rem = removeSchema.safeParse(body);
  if (rem.success) {
    await db.delete(wishlistItems).where(and(eq(wishlistItems.id, rem.data.id), eq(wishlistItems.ownerId, owner.id)));
    return jsonCors({ ok: true });
  }

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return jsonCors({ ok: false, error: "Invalid item." }, 400);
  // Dedupe on (owner, kind, ref).
  const [existing] = await db
    .select({ id: wishlistItems.id })
    .from(wishlistItems)
    .where(and(eq(wishlistItems.ownerId, owner.id), eq(wishlistItems.kind, parsed.data.kind), eq(wishlistItems.ref, parsed.data.ref)))
    .limit(1);
  if (existing) return jsonCors({ ok: true, id: existing.id, deduped: true });
  const [row] = await db
    .insert(wishlistItems)
    .values({ ownerId: owner.id, kind: parsed.data.kind, ref: parsed.data.ref, label: parsed.data.label })
    .returning({ id: wishlistItems.id });
  return jsonCors({ ok: true, id: row.id });
}
