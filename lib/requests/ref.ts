import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requests } from "@/lib/db/schema";

export type RequestPrefix = "TK" | "TF" | "TS" | "TP";

type Db = Awaited<ReturnType<typeof getDb>>;

// Postgres unique-violation SQLSTATE, however the driver wraps it.
export function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string; cause?: { code?: string } })?.code
    ?? (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

/**
 * The next collision-proof request number: one past the highest suffix ever
 * used across ALL request refs. `count(*) + 2400` is unsafe — the moment any
 * request is deleted the count stops being monotonic and lands on a ref already
 * in use, whose UNIQUE constraint then rejects the insert (silent lead loss).
 */
export async function nextRefSeq(db: Db): Promise<number> {
  const [{ maxn }] = await db
    .select({ maxn: sql<number>`coalesce(max(split_part(ref, '-', 2)::int), 2399)` })
    .from(requests);
  return Math.max(2400, Number(maxn ?? 2399) + 1);
}

/**
 * Insert a request with a freshly-allocated, unique ref. Retries on the UNIQUE
 * constraint (bumping the number) so concurrent inserts — or any residual
 * collision — resolve instead of 500ing. The single allocation path shared by
 * every request-creating route (intake, booking, manual create).
 */
export async function insertRequest(
  db: Db,
  prefix: RequestPrefix,
  values: Omit<typeof requests.$inferInsert, "ref">,
): Promise<typeof requests.$inferSelect> {
  let seq = await nextRefSeq(db);
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      const [row] = await db.insert(requests).values({ ...values, ref: `${prefix}-${seq}` }).returning();
      return row;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 24) { seq++; continue; } // ref taken — bump and retry
      throw e;
    }
  }
  throw new Error("Could not allocate a request reference.");
}
