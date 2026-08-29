import { eq } from "drizzle-orm";
import { getDb } from "./index";
import {
  users, sessions, requests, requestNotes, styles, products,
  inspirationShots, contentBlocks, activityLog, services, properties,
  projects, payments, projectUpdates, projectMedia, projectSignoffs, owners, ownerSessions, notifications, siteSettings, handovers, type Role,
} from "./schema";
import { RATE_CARD_DEFAULTS } from "../pricing";

const OWNERS = [
  { name: "Ramy Adel", email: "ramy@example.com", phone: "+20 10 2000 0704" },
  { name: "Yasmine Naguib", email: "yasmine@example.com", phone: "+20 10 1001 2007" },
];
const OWNER_PASSWORD = "owner1234";
import { hashPassword } from "../auth/password";

import { SERVICES, STYLES, PRODUCTS, INSPIRATION, CONTENT_BLOCKS, HANDOVERS } from "./content-data";

const PROPERTIES = [
  { name: "Zed East · Apartment 704", ownerName: "Ramy Adel", ownerPhone: "+20 10 2000 0704", ownerEmail: "ramy@example.com", type: "Apartment", location: "Sheikh Zayed", area: 164, units: 1, style: "warm", status: "in_progress", notes: "Finishing week 5 of 8. Full FF&E." },
  { name: "Hacienda Bay · Chalet 12", ownerName: "Ramy Adel", ownerPhone: "+20 10 2000 0012", ownerEmail: "ramy@example.com", type: "Chalet", location: "North Coast", area: 120, units: 1, style: "coastal", status: "active", notes: "Material selection open." },
  { name: "Katameya · Villa", ownerName: "Ramy Adel", ownerPhone: "+20 10 2000 0430", ownerEmail: "ramy@example.com", type: "Villa", location: "New Cairo", area: 430, units: 1, style: "neoclassic", status: "handed_over", notes: "Warranty until Mar 2027." },
  { name: "Marassi · Townhouse 21", ownerName: "Yasmine Naguib", ownerPhone: "+20 10 1001 2007", ownerEmail: "yasmine@example.com", type: "Townhouse", location: "North Coast", area: 210, units: 1, style: "majlis", status: "active", notes: "Awaiting survey." },
];

const SETTINGS = [
  { key: "pricing", label: "Pricing rate card", group: "pricing", enabled: true, value: RATE_CARD_DEFAULTS },
  { key: "vertical.services", label: "Services", group: "vertical", enabled: true },
  { key: "vertical.styles", label: "Design styles", group: "vertical", enabled: true },
  { key: "vertical.inspiration", label: "Inspiration board", group: "vertical", enabled: true },
  { key: "vertical.ai_studio", label: "AI preview studio", group: "vertical", enabled: true },
  { key: "vertical.marketplace", label: "Marketplace", group: "vertical", enabled: true },
  { key: "vertical.financing", label: "Financing", group: "vertical", enabled: true },
  { key: "vertical.facility", label: "Facility management", group: "vertical", enabled: true },
  { key: "vertical.handovers", label: "Recent handovers", group: "vertical", enabled: true },
  { key: "sla.firstResponseHours", label: "First-response target (hours)", group: "sla", enabled: true, value: 24 },
  { key: "sla.resolveDays", label: "Resolution target (days)", group: "sla", enabled: true, value: 21 },
  { key: "notify.newRequestEmail", label: "Email the team on new requests", group: "notify", enabled: true },
  { key: "notify.customerReceipt", label: "Send confirmation email to the submitter", group: "notify", enabled: true },
  { key: "notify.extraRecipients", label: "Extra alert recipients", group: "notify", enabled: true, value: "" },
];

const DEMO_PASSWORD = "turnkii1234";

const SEED_USERS: { email: string; name: string; role: Role }[] = [
  { email: "admin@turnkii.test", name: "Ramy Adel", role: "admin" },
  { email: "pm@turnkii.test", name: "Nour Hassan", role: "product_manager" },
  { email: "ops@turnkii.test", name: "Karim Fouad", role: "ops_manager" },
  { email: "sara@turnkii.test", name: "Sara Adel", role: "agent" },
  { email: "omar@turnkii.test", name: "Omar Salah", role: "agent" },
  { email: "content@turnkii.test", name: "Lina Adib", role: "content_editor" },
];

const PROP_TYPES = ["Apartment", "Chalet", "Villa", "Duplex", "Studio"];
const LOCATIONS = ["Sheikh Zayed", "New Cairo", "North Coast", "Maadi", "Zamalek", "6th of October"];
const SERVICE_POOL = SERVICES.map((s) => s.name); // match the services-table names so insights line up
const CHANNELS = ["Direct", "Organic search", "Paid search", "Paid social", "Organic social", "Referral", "Email", "WhatsApp"];
const STATUSES = ["new", "contacted", "survey_booked", "scoped", "quoted", "won", "lost"] as const;
const FIRST = ["Mostafa", "Yasmine", "Hussein", "Dalia", "Tarek", "Menna", "Sherif", "Aya", "Khaled", "Farida", "Ziad", "Habiba", "Amr", "Salma"];
const LAST = ["Ibrahim", "El-Masry", "Naguib", "Shawky", "Kamal", "Zaki", "Roshdy", "Halim", "Mansour", "Darwish"];

function pick<T>(arr: readonly T[], i: number): T { return arr[i % arr.length]; }
function daysAgo(d: number): Date { return new Date(Date.now() - d * 86400_000); }

async function main() {
  // Demo seed is for LOCAL development only. It wipes tables and inserts demo
  // accounts with shared passwords — never run it against a real database.
  // For production use `npm run db:bootstrap` (creates a secure admin instead).
  if (process.env.DATABASE_URL && process.env.FORCE_SEED !== "1") {
    console.error(
      "Refusing to seed demo data: DATABASE_URL is set.\n" +
      "For production run `npm run db:bootstrap`. To override locally set FORCE_SEED=1.",
    );
    process.exit(1);
  }

  const db = await getDb();

  if (!process.env.DATABASE_URL) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: "./drizzle" });
    console.log("• migrated (pglite)");
  }

  // clean (FK-safe order)
  await db.delete(notifications);
  await db.delete(activityLog);
  await db.delete(requestNotes);
  await db.delete(sessions);
  await db.delete(requests);
  await db.delete(payments);
  await db.delete(projectSignoffs);
  await db.delete(projectMedia);
  await db.delete(projectUpdates);
  await db.delete(projects);
  await db.delete(ownerSessions);
  await db.delete(owners);
  await db.delete(handovers);
  await db.delete(inspirationShots);
  await db.delete(products);
  await db.delete(styles);
  await db.delete(contentBlocks);
  await db.delete(services);
  await db.delete(properties);
  await db.delete(siteSettings);
  await db.delete(users);

  const pw = hashPassword(DEMO_PASSWORD);
  const insertedUsers = await db
    .insert(users)
    .values(SEED_USERS.map((u) => ({ ...u, passwordHash: pw })))
    .returning();
  const agents = insertedUsers.filter((u) => u.role === "agent" || u.role === "ops_manager");
  console.log(`• ${insertedUsers.length} users`);

  await db.insert(styles).values(STYLES.map((s, i) => ({ ...s, sortOrder: i })));
  await db.insert(products).values(PRODUCTS.map((p, i) => ({ ...p, image: `/products/${i + 1}.jpg`, sortOrder: i })));
  await db.insert(inspirationShots).values(INSPIRATION.map((s, i) => ({ ...s, image: `/inspiration/${i + 1}.jpg`, sortOrder: i })));
  await db.insert(contentBlocks).values(CONTENT_BLOCKS);
  await db.insert(services).values(SERVICES.map((s, i) => ({ ...s, sortOrder: i })));
  await db.insert(handovers).values(HANDOVERS.map((h, i) => ({ ...h, sortOrder: i })));
  const ownerPw = hashPassword(OWNER_PASSWORD);
  const insertedOwners = await db.insert(owners).values(OWNERS.map((o) => ({ ...o, passwordHash: ownerPw }))).returning();
  const ownerByEmail = new Map(insertedOwners.map((o) => [o.email, o.id]));
  const insertedProps = await db.insert(properties)
    .values(PROPERTIES.map((p) => ({ ...p, ownerId: ownerByEmail.get(p.ownerEmail) ?? null })))
    .returning();
  await db.insert(siteSettings).values(SETTINGS);
  console.log(`• ${insertedOwners.length} owner accounts`);
  console.log(`• ${STYLES.length} styles, ${PRODUCTS.length} products, ${INSPIRATION.length} inspiration, ${SERVICES.length} services, ${PROPERTIES.length} properties, ${SETTINGS.length} settings`);

  // requests spread across the pipeline
  const N = 24;
  for (let i = 0; i < N; i++) {
    const created = daysAgo(Math.floor((i * 61) / N) + (i % 3));
    const status = pick(STATUSES, i * 3 + (i % 5));
    const svcCount = 1 + (i % 3);
    const services = Array.from({ length: svcCount }, (_, j) => pick(SERVICE_POOL, i + j));
    const assigned = status === "new" ? null : pick(agents, i).id;
    // First response: mostly within SLA, a few breach.
    const firstResponseAt = status === "new" ? null
      : new Date(created.getTime() + ((i % 6 === 0 ? 40 : 4 + (i % 18)) * 3_600_000));
    const resolvedAt = (status === "won" || status === "lost")
      ? new Date(created.getTime() + ((10 + (i * 3) % 28) * 86_400_000)) : null;
    const [req] = await db.insert(requests).values({
      ref: `TK-${2400 + i}`,
      contactName: `${pick(FIRST, i)} ${pick(LAST, i * 2)}`,
      phone: `+20 10 ${1000 + i} ${2000 + (i * 7) % 8000}`,
      email: `${pick(FIRST, i).toLowerCase()}.${pick(LAST, i).toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
      propertyType: pick(PROP_TYPES, i),
      area: 90 + ((i * 17) % 340),
      units: 1 + (i % 4),
      location: pick(LOCATIONS, i),
      services,
      style: pick(STYLES, i).key,
      budgetPlan: pick(["Milestone plan", "Bank financing", "Rent-backed", "Save ahead"], i),
      priority: pick(["normal", "normal", "high", "low"], i),
      status,
      assignedTo: assigned,
      source: i % 4 === 0 ? "phone" : "website",
      channel: i % 4 === 0 ? "WhatsApp" : pick(CHANNELS, i * 2 + (i % 3)),
      firstResponseAt,
      resolvedAt,
      createdAt: created,
      updatedAt: created,
    }).returning();

    if (status !== "new") {
      await db.insert(requestNotes).values({
        requestId: req.id, authorId: assigned, kind: "call",
        body: "Called back within the day, confirmed scope and booked a survey slot.",
        createdAt: daysAgo(Math.max(0, Math.floor((i * 61) / N) - 1)),
      });
    }
    if (["scoped", "quoted", "won"].includes(status)) {
      await db.insert(requestNotes).values({
        requestId: req.id, authorId: assigned, kind: "survey",
        body: "Survey complete — measurements, MEP condition and photos captured. Scope drafted.",
      });
    }
  }
  console.log(`• ${N} requests with notes`);

  // ---- projects + payment schedules ----
  const staff = insertedUsers.filter((u) => u.role === "ops_manager" || u.role === "admin");
  const RECEIPT = "/receipts/sample.svg";
  const day = (off: number) => new Date(Date.now() + off * 86_400_000);
  const round1k = (n: number) => Math.round(n / 1000) * 1000;
  // schedule template: [kind, label, pct]
  const SCHED: [string, string, number][] = [
    ["downpayment", "Down payment", 0.25],
    ["milestone", "Milestone 1 — on site", 0.35],
    ["milestone", "Milestone 2 — finishing", 0.25],
    ["final", "Final — handover", 0.15],
  ];
  // per profile, per installment: [status, dueOffsetDays, paidOffsetDays|null, receipt]
  const PROFILES: Record<string, [string, number, number | null, boolean][]> = {
    on_track: [["paid", -35, -34, true], ["paid", -5, -4, true], ["due", 25, null, false], ["due", 55, null, false]],
    overdue: [["paid", -45, -44, true], ["due", -10, null, false], ["due", 20, null, false], ["due", 50, null, false]],
    pending_start: [["pending", -2, null, true], ["due", 28, null, false], ["due", 58, null, false], ["due", 88, null, false]],
    complete: [["paid", -180, -179, true], ["paid", -150, -149, true], ["paid", -120, -119, true], ["paid", -90, -89, true]],
  };
  const P = insertedProps;
  const PROJECT_DEFS = [
    { prop: P[0], name: "Zed East 704 — Finishing + full FF&E", services: ["Finishing", "Furniture & FF&E"], rate: 12000, profile: "on_track", startAgo: 40, status: "active" },
    { prop: P[0], name: "Zed East 704 — Kitchen design & build", services: ["Kitchens"], contract: 380000, profile: "overdue", startAgo: 55, status: "active" },
    { prop: P[1], name: "Hacienda Bay 12 — Chalet furnishing", services: ["Furniture & FF&E", "Finishing"], rate: 11000, profile: "pending_start", startAgo: 12, status: "active" },
    { prop: P[2], name: "Katameya Villa — Reception fit-out", services: ["Finishing", "Furniture & FF&E"], rate: 14000, profile: "complete", startAgo: 200, status: "complete" },
    { prop: P[3], name: "Marassi 21 — Turnkey fit-out", services: ["Full turnkey fit-out"], rate: 12000, profile: "on_track", startAgo: 20, status: "active" },
  ];
  let payCount = 0;
  for (const d of PROJECT_DEFS) {
    const contract = d.contract ?? round1k((d.prop?.area ?? 150) * (d.rate ?? 12000));
    const [proj] = await db.insert(projects).values({
      name: d.name, propertyId: d.prop?.id ?? null, ownerId: d.prop?.ownerId ?? null,
      ownerName: d.prop?.ownerName, ownerPhone: d.prop?.ownerPhone, ownerEmail: d.prop?.ownerEmail,
      style: d.prop?.style, services: d.services, contractValue: contract, status: d.status,
      startDate: day(-d.startAgo), dueDate: day(-d.startAgo + 120),
    }).returning();
    const prof = PROFILES[d.profile];
    for (let k = 0; k < SCHED.length; k++) {
      const [kind, label, pct] = SCHED[k];
      const [status, dueOff, paidOff, receipt] = prof[k];
      const recorder = pick(staff, k).id;
      await db.insert(payments).values({
        projectId: proj.id, propertyId: d.prop?.id ?? null,
        kind, label, amount: round1k(contract * pct),
        dueDate: day(dueOff),
        paidAt: paidOff != null ? day(paidOff) : null,
        status,
        method: receipt ? "bank_transfer" : null,
        reference: receipt ? `TRX-${100000 + payCount}` : null,
        receiptUrl: receipt ? RECEIPT : null,
        recordedBy: recorder,
        verifiedBy: status === "paid" ? recorder : null,
      });
      payCount++;
    }
  }
  console.log(`• ${PROJECT_DEFS.length} projects, ${payCount} payments`);

  // ---- progress updates: media items + client decisions + a signed milestone ----
  const A = "https://turnkii.app/assets/";
  const allProjs = await db.select().from(projects);
  const firstProj = allProjs[0];
  const doneProj = allProjs.find((p) => p.status === "complete") ?? allProjs[3];

  type MediaSeed = { type?: "photo" | "video"; url: string; caption: string; status?: string; reason?: string; comment?: string };
  async function seedUpdate(proj: typeof allProjs[number], u: { stage: string; milestone: string; amount: number; body: string; ago: number }, items: MediaSeed[], signed?: boolean) {
    const [upd] = await db.insert(projectUpdates).values({
      projectId: proj.id, authorId: staff[0]?.id, title: u.stage, stage: u.stage, milestone: u.milestone,
      kind: "milestone", body: u.body, amount: u.amount, visibleToOwner: true, sentAt: day(-u.ago), createdAt: day(-u.ago),
    }).returning();
    await db.insert(projectMedia).values(items.map((it, i) => ({
      updateId: upd.id, type: it.type ?? "photo", url: it.url, caption: it.caption,
      status: it.status ?? "pending", reason: it.reason ?? null, comment: it.comment ?? null, sort: i,
    })));
    if (signed) {
      await db.insert(projectSignoffs).values({
        updateId: upd.id, ref: `TK-SO-${proj.id}-${String(upd.id).padStart(2, "0")}`,
        signedByName: proj.ownerName ?? "Account holder", signedByRole: "Owner", ownerId: proj.ownerId ?? null,
        itemCount: items.length, method: "Account sign-off, verified mobile", amount: u.amount, signedAt: day(-u.ago + 1),
      });
    }
    return upd;
  }

  if (firstProj) {
    await seedUpdate(firstProj, { stage: "Week 5 · Joinery and doors", milestone: "Milestone 3 · Joinery and doors", amount: 412000, ago: 5, body: "Wardrobes hung in both bedrooms, doors primed. Handles arrive Sunday." }, [
      { url: A + "style-warm.jpg", caption: "Master wardrobe, doors hung" },
      { url: A + "style-eclectic.jpg", caption: "Second bedroom, primed" },
      { type: "video", url: A + "style-majlis.jpg", caption: "Walk-through, 0:42" },
    ]);
    await seedUpdate(firstProj, { stage: "Week 4 · Plaster and paint", milestone: "Milestone 2 · Plaster and paint", amount: 336000, ago: 14, body: "Two coats on all walls. Ceiling coves complete." }, [
      { url: A + "style-neoclassic.png", caption: "Living room, second coat", status: "accepted" },
      { url: A + "style-coastal.jpg", caption: "Corridor and coves", status: "reshoot", reason: "Too dark", comment: "Can you shoot this with the lights on?" },
    ]);
    await seedUpdate(firstProj, { stage: "Week 2 · MEP rough-in", milestone: "Milestone 1 · MEP rough-in", amount: 288000, ago: 31, body: "Conduits, drainage and AC lines pressure-tested." }, [
      { url: A + "style-warm.jpg", caption: "Kitchen wall, first fix", status: "accepted" },
      { url: A + "style-majlis.jpg", caption: "AC lines, ceiling void", status: "rejected", reason: "Does not match the drawing", comment: "Second outlet is missing on the east wall." },
    ]);
  }
  if (doneProj) {
    await seedUpdate(doneProj, { stage: "Handover photography", milestone: "Milestone 5 · Handover", amount: 640000, ago: 90, body: "Final set after styling. Snag list closed." }, [
      { url: A + "style-neoclassic.png", caption: "Reception, styled", status: "accepted" },
      { type: "video", url: A + "style-warm.jpg", caption: "Full walk-through, 2:10", status: "accepted" },
    ], true);
  }
  console.log("• progress updates with media + a signed milestone");

  // seed notifications for admin + ops (unread)
  const ops = insertedUsers.filter((u) => u.role === "admin" || u.role === "ops_manager");
  const newReqs = await db.select().from(requests).where(eq(requests.status, "new"));
  const notifRows = [];
  for (const u of ops) {
    for (const r of newReqs.slice(0, 3)) {
      notifRows.push({
        userId: u.id, type: "request.new", title: `New request ${r.ref}`,
        body: `${r.contactName} · ${r.location}`, entity: "request", entityId: String(r.id),
        href: `/requests/${r.id}`, read: false,
      });
    }
  }
  if (notifRows.length) await db.insert(notifications).values(notifRows);
  console.log(`• ${notifRows.length} notifications`);

  console.log("\nSeed complete. Demo login (password for all):", DEMO_PASSWORD);
  for (const u of SEED_USERS) console.log(`  ${u.role.padEnd(16)} ${u.email}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
