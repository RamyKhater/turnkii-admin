import * as schema from "./schema";

// Local dev uses embedded PGlite (no infra). Production uses Neon Postgres when
// DATABASE_URL is set. Same schema + queries either way.
type DB = import("drizzle-orm/pglite").PgliteDatabase<typeof schema> &
  { $client: unknown };

const g = globalThis as unknown as { __tkdb?: DB };

async function createDb(): Promise<DB> {
  // Accept whatever Vercel's Neon/Postgres integration injects.
  const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (conn) {
    const { drizzle } = await import("drizzle-orm/neon-http");
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(conn);
    return drizzle(sql, { schema }) as unknown as DB;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = process.env.PGLITE_DIR || ".pglite";
  const client = new PGlite(dir);
  return drizzle(client, { schema }) as unknown as DB;
}

export async function getDb(): Promise<DB> {
  if (!g.__tkdb) g.__tkdb = await createDb();
  return g.__tkdb;
}
