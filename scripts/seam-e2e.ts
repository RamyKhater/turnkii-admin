/* Local end-to-end test of the Turnkii↔FLPP seam (Phase 1). Runs against a
   scratch PGlite DB — never the shared Neon DB. Drives the real route handlers
   and the ensure helper, then asserts the project/updates/media/payments state.
   Run: env -u DATABASE_URL -u POSTGRES_URL PGLITE_DIR=/tmp/seam.pglite \
        FLPP_API_TOKEN=test-token npx tsx scripts/seam-e2e.ts */
process.env.FLPP_API_TOKEN ||= "test-token";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requests, projects, scopeOfWork, projectUpdates, projectMedia, payments } from "@/lib/db/schema";
import { ensureProjectForRequest } from "@/lib/projects/ensure";
import { POST as eventsPOST } from "@/app/api/flpp/events/route";
import { POST as sowPOST } from "@/app/api/flpp/sow/route";

let pass = 0, fail = 0;
function check(label: string, cond: boolean, got?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${got !== undefined ? `  (got: ${JSON.stringify(got)})` : ""}`); }
}
const post = (path: string, obj: unknown) =>
  new Request(`http://local${path}`, { method: "POST", headers: { authorization: "Bearer test-token", "content-type": "application/json" }, body: JSON.stringify(obj) });

async function main() {
  const db = await getDb();
  const REF = "TRN-E2E", TICKET = "FLP-E2E";

  // Clean any prior run.
  await db.delete(requests).where(eq(requests.ref, REF));

  console.log("\n1. ensureProjectForRequest (auto-create hub on won)");
  const [r] = await db.insert(requests).values({
    ref: REF, contactName: "E2E Tester", phone: "+20100000000", email: "e2e@example.com",
    propertyType: "Apartment", location: "New Cairo", services: ["finishing"], style: "warm",
    status: "won", indicativeLimit: 1_800_000,
  }).returning();
  const ens = await ensureProjectForRequest(r.id);
  check("project created", ens.created === true, ens);
  const ens2 = await ensureProjectForRequest(r.id);
  check("idempotent (same id, not re-created)", ens2.id === ens.id && ens2.created === false, ens2);
  let [proj] = await db.select().from(projects).where(eq(projects.id, ens.id));
  check("linked request_ref", proj.requestRef === REF, proj.requestRef);
  check("stage = won", proj.stage === "won", proj.stage);
  check("no ticket bound yet", proj.flppTicketRef === null, proj.flppTicketRef);

  console.log("\n2. SoW share binds project↔ticket");
  const sowRes = await (await sowPOST(post("/api/flpp/sow", { token: "sow-e2e", docRef: "SOW-E2E", requestRef: REF, ticketRef: TICKET, data: { scope: "Full finishing" } }))).json();
  check("sow ok", sowRes.ok === true, sowRes);
  [proj] = await db.select().from(projects).where(eq(projects.id, ens.id));
  check("flpp_ticket_ref bound", proj.flppTicketRef === TICKET, proj.flppTicketRef);
  check("stage = sow_review", proj.stage === "sow_review", proj.stage);
  const [sow] = await db.select().from(scopeOfWork).where(eq(scopeOfWork.token, "sow-e2e"));
  check("sow linked to project", sow.projectId === ens.id, sow.projectId);

  console.log("\n3. project.progress → update + media + pct/stage");
  const progRes = await (await eventsPOST(post("/api/flpp/events", { name: "project.progress", ticketRef: TICKET, eventId: "evt-prog", payload: { pct: 40, milestone: "Week 5 · Joinery", stage: "Joinery", media: [{ url: "https://cdn.example/p1.jpg", type: "photo", caption: "Joinery detail" }] } }))).json();
  check("matched project", progRes.matched === true, progRes);
  const progUpdates = await db.select().from(projectUpdates).where(and(eq(projectUpdates.projectId, ens.id), eq(projectUpdates.kind, "progress")));
  check("1 progress update", progUpdates.length === 1, progUpdates.length);
  const media = progUpdates[0] ? await db.select().from(projectMedia).where(eq(projectMedia.updateId, progUpdates[0].id)) : [];
  check("1 media row", media.length === 1, media.length);
  [proj] = await db.select().from(projects).where(eq(projects.id, ens.id));
  check("pct_complete = 40", proj.pctComplete === 40, proj.pctComplete);
  check("stage = in_execution", proj.stage === "in_execution", proj.stage);

  console.log("\n4. work.certified → milestone update + client payment");
  await (await eventsPOST(post("/api/flpp/events", { name: "work.certified", ticketRef: TICKET, eventId: "evt-cert", payload: { milestone: "Joinery milestone", amount: 250_000 } }))).json();
  const mUpdates = await db.select().from(projectUpdates).where(and(eq(projectUpdates.projectId, ens.id), eq(projectUpdates.kind, "milestone")));
  check("1 milestone update", mUpdates.length === 1, mUpdates.length);
  const pays = await db.select().from(payments).where(and(eq(payments.projectId, ens.id), eq(payments.label, "Joinery milestone")));
  check("payment raised (pending, 250k)", pays.length === 1 && pays[0].status === "pending" && pays[0].amount === 250_000, pays[0]);
  check("update linked to payment", !!mUpdates[0]?.paymentId && mUpdates[0].paymentId === pays[0]?.id, mUpdates[0]?.paymentId);
  [proj] = await db.select().from(projects).where(eq(projects.id, ens.id));
  check("stage = certifying", proj.stage === "certifying", proj.stage);

  console.log("\n5. replay (idempotency)");
  const replay = await (await eventsPOST(post("/api/flpp/events", { name: "project.progress", ticketRef: TICKET, eventId: "evt-prog", payload: { pct: 99, milestone: "DUP" } }))).json();
  check("deduped response", replay.deduped === true, replay);
  const progAfter = await db.select().from(projectUpdates).where(and(eq(projectUpdates.projectId, ens.id), eq(projectUpdates.kind, "progress")));
  check("no duplicate progress update", progAfter.length === 1, progAfter.length);
  [proj] = await db.select().from(projects).where(eq(projects.id, ens.id));
  check("pct unchanged (still 40)", proj.pctComplete === 40, proj.pctComplete);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("harness error:", e); process.exit(2); });
