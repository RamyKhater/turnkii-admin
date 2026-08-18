/**
 * Production admin bootstrap — creates the FIRST admin user from env vars.
 * Run once after migrations, against your real database:
 *
 *   DATABASE_URL=postgres://…  \
 *   ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='a-strong-password' ADMIN_NAME='Your Name' \
 *   npm run db:bootstrap
 *
 * Idempotent: does nothing if a user with that email already exists.
 * No demo data, no weak defaults.
 */
import { eq, sql } from "drizzle-orm";
import { getDb } from "./index";
import { users, siteSettings, styles, products, services, inspirationShots, contentBlocks } from "./schema";
import { hashPassword } from "../auth/password";
import { SERVICES, STYLES, PRODUCTS, INSPIRATION, CONTENT_BLOCKS } from "./content-data";

const BASELINE_SETTINGS = [
  { key: "vertical.services", label: "Services", group: "vertical", enabled: true },
  { key: "vertical.styles", label: "Design styles", group: "vertical", enabled: true },
  { key: "vertical.inspiration", label: "Inspiration board", group: "vertical", enabled: true },
  { key: "vertical.ai_studio", label: "AI preview studio", group: "vertical", enabled: true },
  { key: "vertical.marketplace", label: "Marketplace", group: "vertical", enabled: true },
  { key: "vertical.financing", label: "Financing", group: "vertical", enabled: true },
  { key: "sla.firstResponseHours", label: "First-response target (hours)", group: "sla", enabled: true, value: 24 },
  { key: "sla.resolveDays", label: "Resolution target (days)", group: "sla", enabled: true, value: 21 },
];

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Admin";

  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD.");
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("ADMIN_EMAIL is not a valid email.");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("ADMIN_PASSWORD must be at least 10 characters.");
    process.exit(1);
  }

  const db = await getDb();

  // 1) admin user (idempotent)
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    console.log(`Admin already exists: ${email} — leaving it as-is.`);
  } else {
    await db.insert(users).values({ email, name, role: "admin", passwordHash: hashPassword(password) });
    console.log(`✓ Created admin ${email}.`);
  }

  // 2) baseline site settings (feature flags + SLA) — only if none exist
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(siteSettings);
  if (n === 0) {
    await db.insert(siteSettings).values(BASELINE_SETTINGS);
    console.log(`✓ Seeded ${BASELINE_SETTINGS.length} baseline settings.`);
  } else {
    console.log(`Settings already present (${n}) — leaving them.`);
  }

  // 3) baseline site content — each table only if empty, so it never clobbers
  //    edits. This is the content the admin edits and the site renders.
  const seedIfEmpty = async (
    label: string,
    table: typeof styles | typeof products | typeof services | typeof inspirationShots | typeof contentBlocks,
    rows: Record<string, unknown>[],
  ) => {
    const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(table);
    if (c === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.insert(table).values(rows as any);
      console.log(`✓ Seeded ${rows.length} ${label}.`);
    } else {
      console.log(`${label} already present (${c}) — leaving them.`);
    }
  };

  await seedIfEmpty("styles", styles, STYLES.map((s, i) => ({ ...s, sortOrder: i })));
  await seedIfEmpty("services", services, SERVICES.map((s, i) => ({ ...s, sortOrder: i })));
  await seedIfEmpty("products", products, PRODUCTS.map((p, i) => ({ ...p, image: `/products/${i + 1}.jpg`, sortOrder: i })));
  await seedIfEmpty("inspiration shots", inspirationShots, INSPIRATION.map((s, i) => ({ ...s, image: `/inspiration/${i + 1}.jpg`, sortOrder: i })));
  await seedIfEmpty("content blocks", contentBlocks, CONTENT_BLOCKS);

  console.log("Done. Sign in and build out your team from Settings → Team.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
