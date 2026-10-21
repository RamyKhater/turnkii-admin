/* Proves the intake pipeline hardening against a scratch PGlite DB (never Neon):
   the shared collision-proof ref allocator, the full intake route past a seeded
   collision, and the dead-letter capture that keeps a lead when an insert fails.
   Run: env -u DATABASE_URL -u POSTGRES_URL PGLITE_DIR=/tmp/intake.pglite \
        npx tsx scripts/intake-ref-test.ts */
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requests, failedSubmissions } from "@/lib/db/schema";
import { insertRequest, nextRefSeq } from "@/lib/requests/ref";
import { captureFailedSubmission } from "@/lib/requests/capture";
import { POST as intakePOST } from "@/app/api/requests/intake/route";
import { GET as healthGET } from "@/app/api/health/integrity/route";

let pass = 0, fail = 0;
const check = (label: string, cond: boolean, got?: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${got !== undefined ? `  (got: ${JSON.stringify(got)})` : ""}`); }
};
const req = (body: unknown) =>
  new Request("http://local/api/requests/intake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
// The insert completes before the route's post-response after() hook, which
// throws outside a request scope in tsx. Treat that specific throw as success.
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
  await db.delete(failedSubmissions);

  console.log("\n1. Shared allocator is collision-proof past a seeded collision");
  // 3 rows incl. the exact ref old count()+2400 would reuse → old code collided.
  await db.insert(requests).values([
    { ref: "TK-2401", contactName: "A", phone: "1" },
    { ref: "TK-2402", contactName: "B", phone: "2" },
    { ref: "TK-2403", contactName: "C", phone: "3" },
  ]);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(requests);
  check("old count()+2400 would have collided on TK-2403", `TK-${2400 + n}` === "TK-2403");
  check("nextRefSeq jumps past the max (2404)", (await nextRefSeq(db)) === 2404);
  const r1 = await insertRequest(db, "TK", { contactName: "Allocator One", phone: "9" });
  const r2 = await insertRequest(db, "TK", { contactName: "Allocator Two", phone: "9" });
  check("allocates TK-2404 then TK-2405 without throwing", r1.ref === "TK-2404" && r2.ref === "TK-2405", [r1.ref, r2.ref]);

  console.log("\n2. Full intake route saves a new brief past the collision");
  await submit({ contactName: "New Lead", phone: "+201111", propertyType: "Apartment", location: "Maadi", kind: "brief" });
  const saved = await db.select().from(requests).where(eq(requests.contactName, "New Lead"));
  check("new website brief persisted", saved.length === 1, saved.length);
  check("got a fresh unique ref", saved[0] && saved[0].ref === "TK-2406", saved[0]?.ref);

  console.log("\n3. Dead-letter captures a lead that cannot be saved");
  const id = await captureFailedSubmission("intake", { contactName: "Lost Larry", phone: "+205555", location: "Zamalek", kind: "brief" }, new Error("boom"));
  check("capture returns an id", typeof id === "number", id);
  const [cap] = await db.select().from(failedSubmissions).where(eq(failedSubmissions.id, id!));
  check("stored as pending", cap?.status === "pending", cap?.status);
  check("contact lifted out for the admin list", cap?.contactName === "Lost Larry" && cap?.phone === "+205555", { n: cap?.contactName, p: cap?.phone });
  check("raw payload retained", (cap?.payload as { location?: string })?.location === "Zamalek", cap?.payload);
  check("error recorded", cap?.error === "boom", cap?.error);

  console.log("\n4. Health check flags the pending capture, then goes green once handled");
  const h1 = await (await healthGET(new Request("http://local/api/health/integrity"))).json();
  check("reports unhealthy with a pending capture", h1.healthy === false && h1.pendingCaptures === 1, h1);
  check("no duplicate/collision issues (allocator sound)", !h1.issues.some((s: string) => /Duplicate|already taken/.test(s)), h1.issues);
  await db.update(failedSubmissions).set({ status: "dismissed" }).where(eq(failedSubmissions.id, id!));
  const h2 = await (await healthGET(new Request("http://local/api/health/integrity"))).json();
  check("green once nothing is pending", h2.healthy === true && h2.issues.length === 0, h2);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("harness error:", e); process.exit(2); });
