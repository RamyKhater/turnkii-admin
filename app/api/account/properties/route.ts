import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { properties } from "@/lib/db/schema";
import { getOwnerFromToken } from "@/lib/owner/session";
import { ACCOUNT_CORS, jsonCors, bearer } from "@/lib/account/http";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: ACCOUNT_CORS });
}

export async function GET(req: Request) {
  const owner = await getOwnerFromToken(bearer(req));
  if (!owner) return jsonCors({ ok: false, error: "Not signed in." }, 401);
  const db = await getDb();
  const rows = await db
    .select()
    .from(properties)
    .where(eq(properties.ownerId, owner.id))
    .orderBy(desc(properties.createdAt));
  return jsonCors({ ok: true, properties: rows });
}

const addSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().trim().max(60).optional(),
  location: z.string().trim().max(120).optional(),
  area: z.coerce.number().int().positive().max(100000).optional(),
  units: z.coerce.number().int().positive().max(10000).optional(),
  style: z.string().trim().max(60).optional(),
});

export async function POST(req: Request) {
  const owner = await getOwnerFromToken(bearer(req));
  if (!owner) return jsonCors({ ok: false, error: "Not signed in." }, 401);
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return jsonCors({ ok: false, error: "Give the property a name." }, 400);
  const db = await getDb();
  const [row] = await db
    .insert(properties)
    .values({
      name: parsed.data.name,
      ownerId: owner.id,
      ownerName: owner.name,
      ownerEmail: owner.email,
      ownerPhone: owner.phone,
      type: parsed.data.type,
      location: parsed.data.location,
      area: parsed.data.area,
      units: parsed.data.units,
      style: parsed.data.style,
      status: "active",
    })
    .returning({ id: properties.id });
  return jsonCors({ ok: true, id: row.id });
}
