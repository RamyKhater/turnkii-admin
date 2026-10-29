/* Local end-to-end test of the Turnkii↔FLPP seam (Phase 1). Runs against a
   scratch PGlite DB — never the shared Neon DB. Drives the real route handlers
   and the ensure helper, then asserts the project/updates/media/payments state.
   Run: env -u DATABASE_URL -u POSTGRES_URL PGLITE_DIR=/tmp/seam.pglite \
        FLPP_API_TOKEN=test-token npx tsx scripts/seam-e2e.ts */
process.env.FLPP_API_TOKEN ||= "test-token";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requests, projects, scopeOfWork, projectUpdates, projectMedia, payments, variations, projectHandovers, estimates } from "@/lib/db/schema";
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
  // Apply the schema to the scratch PGlite DB (never runs against Neon).
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: "./drizzle" });
  }
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

  console.log("\n6. FLPP actor attribution on a synced update");
  await (await eventsPOST(post("/api/flpp/events", { name: "project.progress", ticketRef: TICKET, eventId: "evt-prog2", payload: { pct: 70, milestone: "Week 7 · Paint", actor: { role: "projects", name: "Mina" } } }))).json();
  const attributed = await db.select().from(projectUpdates).where(and(eq(projectUpdates.projectId, ens.id), eq(projectUpdates.flppActor, "projects · Mina")));
  check("update carries flpp_actor", attributed.length === 1, attributed.length);
  [proj] = await db.select().from(projects).where(eq(projects.id, ens.id));
  check("pct advanced to 70", proj.pctComplete === 70, proj.pctComplete);

  console.log("\n7. handover.ready → handover stage + customer update");
  await (await eventsPOST(post("/api/flpp/events", { name: "handover.ready", ticketRef: TICKET, eventId: "evt-hand", payload: { actor: { role: "ops", name: "Sara" } } }))).json();
  [proj] = await db.select().from(projects).where(eq(projects.id, ens.id));
  check("stage = handover", proj.stage === "handover", proj.stage);
  check("pct = 100", proj.pctComplete === 100, proj.pctComplete);
  const handover = await db.select().from(projectUpdates).where(and(eq(projectUpdates.projectId, ens.id), eq(projectUpdates.title, "Ready for handover")));
  check("handover update created + attributed", handover.length === 1 && handover[0]?.flppActor === "ops · Sara", handover[0]);

  console.log("\n8. supply/pricing risk flag (F3)");
  await (await eventsPOST(post("/api/flpp/events", { name: "po.shortfall", ticketRef: TICKET, eventId: "evt-short", payload: { reason: "Tiles short on a PO" } }))).json();
  [proj] = await db.select().from(projects).where(eq(projects.id, ens.id));
  check("risk flag set", proj.riskFlag === "Tiles short on a PO", proj.riskFlag);
  await (await eventsPOST(post("/api/flpp/events", { name: "po.delivered", ticketRef: TICKET, eventId: "evt-deliv", payload: {} }))).json();
  [proj] = await db.select().from(projects).where(eq(projects.id, ens.id));
  check("risk flag cleared on delivery", proj.riskFlag === null, proj.riskFlag);

  // ───────────────────────── Wave 2: F1 / F5 / F6 / F7 / F9 ─────────────────
  console.log("\n9. F1 build gate — green only when SoW approved AND scope locked");
  const REF2 = "TRN-E2E2", TICKET2 = "FLP-E2E2";
  await db.delete(requests).where(eq(requests.ref, REF2));
  const [r2] = await db.insert(requests).values({
    ref: REF2, contactName: "Gate Tester", email: "gate@example.com",
    propertyType: "Villa", location: "Sheikh Zayed", services: ["finishing"], status: "won",
  }).returning();
  const ens3 = await ensureProjectForRequest(r2.id);
  await (await sowPOST(post("/api/flpp/sow", { token: "sow-e2e2", docRef: "SOW-E2E2", requestRef: REF2, ticketRef: TICKET2, data: { scope: "Full" } }))).json();
  // scope.locked alone: not cleared yet (SoW not approved).
  await (await eventsPOST(post("/api/flpp/events", { name: "scope.locked", ticketRef: TICKET2, eventId: "evt-lock2", payload: {} }))).json();
  let [p2] = await db.select().from(projects).where(eq(projects.id, ens3.id));
  check("not cleared on scope.locked alone", p2.buildClearedAt === null, p2.buildClearedAt);
  // SoW approved (simulating acceptSow's effect) + re-run the gate via a lock replay-free path.
  await db.update(projects).set({ sowApprovedAt: new Date() }).where(eq(projects.id, ens3.id));
  await (await eventsPOST(post("/api/flpp/events", { name: "scope.locked", ticketRef: TICKET2, eventId: "evt-lock2b", payload: {} }))).json();
  [p2] = await db.select().from(projects).where(eq(projects.id, ens3.id));
  check("cleared once BOTH facts hold", p2.buildClearedAt !== null, p2.buildClearedAt);

  console.log("\n10. F5 variation — pending until customer approves");
  await (await eventsPOST(post("/api/flpp/events", { name: "variation.requested", ticketRef: TICKET2, eventId: "evt-vo", payload: { voId: 77, costDelta: 120000, description: "Upgrade to marble sills", bearer: "client" } }))).json();
  let vos = await db.select().from(variations).where(eq(variations.projectId, ens3.id));
  check("1 pending variation", vos.length === 1 && vos[0].status === "pending" && vos[0].amount === 120000, vos[0]);
  check("variation carries FLPP vo id", vos[0]?.flppVoId === 77, vos[0]?.flppVoId);
  // Replay dedupes by FLPP vo id.
  await (await eventsPOST(post("/api/flpp/events", { name: "variation.requested", ticketRef: TICKET2, eventId: "evt-vo2", payload: { voId: 77, costDelta: 120000, description: "dup", bearer: "client" } }))).json();
  vos = await db.select().from(variations).where(eq(variations.projectId, ens3.id));
  check("no duplicate variation on replay", vos.length === 1, vos.length);

  console.log("\n11. F7 finance.summary — reconciliation figures stored");
  await (await eventsPOST(post("/api/flpp/events", { name: "finance.summary", ticketRef: TICKET2, eventId: "evt-fin", payload: { certified: 900000, committed: 1100000, paid: 820000, retention: 45000 } }))).json();
  [p2] = await db.select().from(projects).where(eq(projects.id, ens3.id));
  check("certified stored", p2.flppCertified === 900000, p2.flppCertified);
  check("paid stored", p2.flppPaid === 820000, p2.flppPaid);
  check("retention stored", p2.flppRetention === 45000, p2.flppRetention);
  check("finance synced timestamp set", p2.financeSyncedAt !== null, p2.financeSyncedAt);

  console.log("\n12. F6/F9 handover pack — pack assembled with delivering party + as-built media");
  // Seed one accepted as-built photo so the pack picks it up.
  const [hu] = await db.insert(projectUpdates).values({ projectId: ens3.id, title: "As-built", kind: "progress", visibleToOwner: true }).returning();
  await db.insert(projectMedia).values({ updateId: hu.id, type: "photo", url: "https://cdn.example/final.jpg", status: "accepted", caption: "Living room" });
  await (await eventsPOST(post("/api/flpp/events", { name: "handover.ready", ticketRef: TICKET2, eventId: "evt-hand2", payload: { deliveredBy: "Cairo Fit-out Co.", rating: 5, warranty: "24-month warranty" } }))).json();
  const [h] = await db.select().from(projectHandovers).where(eq(projectHandovers.projectId, ens3.id));
  check("handover pack created", !!h && h.status === "ready", h);
  check("delivering party carried (F9)", h?.deliveredByName === "Cairo Fit-out Co." && h?.deliveredRating === 5, { by: h?.deliveredByName, r: h?.deliveredRating });
  check("as-built media in pack", (h?.media?.length ?? 0) === 1, h?.media?.length);
  [p2] = await db.select().from(projects).where(eq(projects.id, ens3.id));
  check("project credits delivering party", p2.deliveredByName === "Cairo Fit-out Co.", p2.deliveredByName);

  console.log("\n13. estimate.confirmed — FLPP confirms a figure, Turnkii flags it for sign-off");
  const [estRow] = await db.insert(estimates).values({
    ref: "EST-9001", requestId: r.id, brief: {}, tier: "standard",
    autoQuotation: 6_500_000, status: "requested", slaDueAt: new Date(Date.now() + 24 * 3600_000),
  }).returning();
  const ecRes = await (await eventsPOST(post("/api/flpp/events", { name: "estimate.confirmed", eventId: "evt-est", payload: { requestRef: REF, estimateRef: "EST-9001", sheetRef: "TK-QT-2026-0007", amount: 7_000_000 } }))).json();
  check("matched the estimate", ecRes.estimate === "EST-9001", ecRes);
  const [estAfter] = await db.select().from(estimates).where(eq(estimates.id, estRow.id));
  check("confirmed quotation stored (7,000,000)", estAfter.confirmedQuotation === 7_000_000, estAfter.confirmedQuotation);
  check("status → confirmed (awaiting sign-off)", estAfter.status === "confirmed", estAfter.status);
  check("FLPP sheet ref bound", estAfter.flppSheetRef === "TK-QT-2026-0007", estAfter.flppSheetRef);
  const ecDup = await (await eventsPOST(post("/api/flpp/events", { name: "estimate.confirmed", eventId: "evt-est", payload: { requestRef: REF, amount: 999 } }))).json();
  check("replay deduped (no overwrite)", ecDup.deduped === true, ecDup);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("harness error:", e); process.exit(2); });
