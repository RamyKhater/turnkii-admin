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
import { users, siteSettings, styles, products, services, inspirationShots, contentBlocks, handovers } from "./schema";
import { hashPassword } from "../auth/password";
import { SERVICES, STYLES, PRODUCTS, INSPIRATION, CONTENT_BLOCKS, HANDOVERS } from "./content-data";

const BASELINE_SETTINGS = [
  { key: "vertical.services", label: "Services", group: "vertical", enabled: true },
  { key: "vertical.styles", label: "Design styles", group: "vertical", enabled: true },
  { key: "vertical.inspiration", label: "Inspiration board", group: "vertical", enabled: true },
  { key: "vertical.ai_studio", label: "AI preview studio", group: "vertical", enabled: true },
  { key: "vertical.marketplace", label: "Marketplace", group: "vertical", enabled: true },
  { key: "vertical.financing", label: "Financing", group: "vertical", enabled: true },
  { key: "vertical.facility", label: "Facility management", group: "vertical", enabled: true },
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

  // 2) baseline site settings (feature flags + SLA) — insert any that are missing
  //    (idempotent: never clobbers an existing flag's enabled/value), so new
  //    verticals like `vertical.facility` reach an already-provisioned prod DB.
  const settingKeys = new Set((await db.select({ key: siteSettings.key }).from(siteSettings)).map((r) => r.key));
  const missing = BASELINE_SETTINGS.filter((s) => !settingKeys.has(s.key));
  if (missing.length) {
    await db.insert(siteSettings).values(missing).onConflictDoNothing();
    console.log(`✓ Added ${missing.length} missing settings: ${missing.map((s) => s.key).join(", ")}`);
  } else {
    console.log(`Settings already complete (${settingKeys.size}) — leaving them.`);
  }

  // 3) baseline site content — each table only if empty, so it never clobbers
  //    edits. This is the content the admin edits and the site renders.
  const seedIfEmpty = async (
    label: string,
    table: typeof styles | typeof products | typeof services | typeof inspirationShots | typeof contentBlocks | typeof handovers,
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
  await seedIfEmpty("handovers", handovers, HANDOVERS.map((h, i) => ({ ...h, sortOrder: i })));

  // 4) backfill styles that predate closeups/absolute hero images — only fills
  //    gaps (empty closeups, or an old "/styles/..." hero path); never clobbers edits.
  const existingStyles = await db.select().from(styles);
  for (const row of existingStyles) {
    const seed = STYLES.find((s) => s.key === row.key);
    if (!seed) continue;
    const patch: Record<string, unknown> = {};
    if (!row.closeups || (row.closeups as unknown[]).length === 0) patch.closeups = seed.closeups;
    if (!row.heroImage || row.heroImage.startsWith("/styles/")) patch.heroImage = seed.heroImage;
    if (Object.keys(patch).length) {
      patch.updatedAt = new Date();
      await db.update(styles).set(patch).where(eq(styles.id, row.id));
      console.log(`✓ Backfilled style ${row.key} (${Object.keys(patch).filter((k) => k !== "updatedAt").join(", ")}).`);
    }
  }

  // 5) backfill inspiration/product images that still point at the non-existent
  //    seed placeholders ("/inspiration/N.jpg", "/products/N.jpg") so the admin
  //    shows real thumbnails (the site already falls back to these). Never
  //    touches a real uploaded (http) image.
  const INSP_ASSET: Record<string, string> = {
    warm: "style-warm.jpg", neoclassic: "style-neoclassic.png", majlis: "style-majlis.jpg",
    eclectic: "style-eclectic.jpg", coastal: "style-coastal.jpg",
  };
  const CAT_ASSET: Record<string, string> = {
    Seating: "style-warm.jpg", Tables: "style-warm.jpg", Beds: "style-majlis.jpg",
    Lighting: "style-neoclassic.png", Appliances: "style-coastal.jpg",
    Outdoor: "style-coastal.jpg", "Soft goods": "style-eclectic.jpg",
  };
  const asset = (f: string) => `https://turnkii-site.vercel.app/assets/${f}`;

  const shots = await db.select().from(inspirationShots);
  let ns = 0;
  for (const row of shots) {
    if (!row.image || row.image.startsWith("/inspiration/")) {
      await db.update(inspirationShots)
        .set({ image: asset(INSP_ASSET[row.key] || "style-warm.jpg"), updatedAt: new Date() })
        .where(eq(inspirationShots.id, row.id));
      ns++;
    }
  }
  if (ns) console.log(`✓ Backfilled ${ns} inspiration images.`);

  const prods = await db.select().from(products);
  let np = 0;
  for (const row of prods) {
    if (!row.image || row.image.startsWith("/products/")) {
      await db.update(products)
        .set({ image: asset(CAT_ASSET[row.category ?? ""] || "style-warm.jpg"), updatedAt: new Date() })
        .where(eq(products.id, row.id));
      np++;
    }
  }
  if (np) console.log(`✓ Backfilled ${np} product images.`);

  console.log("Done. Sign in and build out your team from Settings → Team.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
