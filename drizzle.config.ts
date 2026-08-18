import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Only used by `drizzle-kit migrate` / `studio` against a real Postgres
    // (production/Neon). Local dev migrates PGlite programmatically in seed.ts.
    // Prefer a direct (unpooled) connection for DDL; fall back to pooled.
    url:
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      "postgres://localhost/placeholder",
  },
} satisfies Config;
