// Runs Drizzle migrations against DATABASE_URL, then exits. Used as part of the
// Vercel build command. No-ops (never fails the build) when DATABASE_URL is
// absent — e.g. preview builds without a database attached.
import { execSync } from "node:child_process";

const hasDb =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!hasDb) {
  console.log("[migrate] No database URL set — skipping migrations.");
  process.exit(0);
}

console.log("[migrate] Applying Drizzle migrations…");
execSync("npx drizzle-kit migrate", { stdio: "inherit" });
console.log("[migrate] Done.");
