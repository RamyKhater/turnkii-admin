/* Reproduces the intake ref-collision outage and proves the fix, against a
   scratch PGlite DB (never Neon). Seeds a request whose ref equals the OLD
   count()+2400 value so the old code would collide, then drives the real intake
   route and asserts the submission saves with a fresh, unique ref.
   Run: env -u DATABASE_URL -u POSTGRES_URL PGLITE_DIR=/tmp/intake.pglite \
        npx tsx scripts/intake-ref-test.ts */
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requests } from "@/lib/db/schema";
import { POST as intakePOST } from "@/app/api/requests/intake/route";

let pass = 0, fail = 0;
const check = (label: string, cond: boolean, got?: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${got !== undefined ? `  (got: ${JSON.stringify(got)})` : ""}`); }
};
const req = (body: unknown) =>
  new Request("http://local/api/requests/intake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
// The insert + ref allocation (the code under test) completes before the route's
// post-response after() hook, which throws outside a request scope in tsx. Treat
// that specific throw as success and assert on the persisted row instead.
async function submit(body: unknown): Promise<void> {
  try { await intakePOST(req(body)); }
  catch (e) { if (!(e instanceof Error && e.message.includes("after"))) throw e; }
}

async function main() {
  const db = await getDb();
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: "./drizzle" });
  }
  await db.delete(requests);

  console.log("\nSeed the collision: 3 rows, one already holding TK-2403 (= old count()+2400)");
  // 3 rows total → old scheme's next brief = TK-(2400+3) = TK-2403, which we make taken.
  await db.insert(requests).values([
    { ref: "TK-2401", contactName: "A", phone: "1" },
    { ref: "TK-2402", contactName: "B", phone: "2" },
    { ref: "TK-2403", contactName: "C", phone: "3" }, // the ref old code would reuse
  ]);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(requests);
  check("old count()+2400 would collide", `TK-${2400 + n}` === "TK-2403");

  console.log("\n1. A new website brief now saves (no collision)");
  await submit({ contactName: "New Lead", phone: "+201111", propertyType: "Apartment", location: "Maadi", kind: "brief" });
  const saved1 = await db.select().from(requests).where(eq(requests.ref, "TK-2404"));
  check("saved past the max as TK-2404 (old code would have 500'd)", saved1.length === 1 && saved1[0].contactName === "New Lead", saved1[0]);

  console.log("\n2. A second submission gets the next distinct ref");
  await submit({ contactName: "Second Lead", phone: "+202222", kind: "brief" });
  const saved2 = await db.select().from(requests).where(eq(requests.ref, "TK-2405"));
  check("saved as TK-2405", saved2.length === 1 && saved2[0].contactName === "Second Lead", saved2[0]);

  console.log("\n3. A financing submission is unaffected and unique");
  await submit({ contactName: "Fin Lead", phone: "+203333", kind: "financing", monthlyIncome: 40000 });
  const saved3 = await db.select().from(requests).where(eq(requests.ref, "TF-2406"));
  check("saved as TF-2406", saved3.length === 1, saved3[0]);

  const total = await db.select({ n: sql<number>`count(*)::int` }).from(requests);
  check("all three new rows saved (6 total)", total[0].n === 6, total[0].n);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("harness error:", e); process.exit(2); });
