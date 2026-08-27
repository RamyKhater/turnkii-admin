import { eq } from "drizzle-orm";
import Link from "next/link";
import { requireOwner } from "@/lib/owner/session";
import { getDb } from "@/lib/db";
import { inArray, desc, asc } from "drizzle-orm";
import { properties, projects, payments, projectUpdates, projectMedia, projectSignoffs } from "@/lib/db/schema";
import { PortalShell } from "@/components/portal/shell";
import { PayButton } from "@/components/portal/pay-dialog";
import { Approvals, type PUpdate } from "@/components/portal/approvals";
import { fmtEGP, summarize, paymentState, PAYMENT_STATE_META, KIND_LABEL } from "@/lib/payments";

export default async function PortalHome() {
  const owner = await requireOwner();
  const db = await getDb();
  const props = await db.select().from(properties).where(eq(properties.ownerId, owner.id));
  const projs = await db.select().from(projects).where(eq(projects.ownerId, owner.id));
  const projIds = new Set(projs.map((p) => p.id));
  const propIds = new Set(props.map((p) => p.id));
  const all = await db.select().from(payments);
  const mine = all.filter((p) => (p.projectId && projIds.has(p.projectId)) || (p.propertyId && propIds.has(p.propertyId)));

  const totalContract = projs.reduce((a, p) => a + p.contractValue, 0);
  const sum = summarize(mine, totalContract);
  const attention = mine
    .map((p) => ({ p, st: paymentState(p) }))
    .filter(({ st }) => st.state === "due" || st.state === "overdue" || st.state === "pending")
    .sort((a, b) => (a.st.daysTillDue ?? 0) - (b.st.daysTillDue ?? 0));

  const projName = new Map(projs.map((p) => [p.id, p.name]));
  const updates = projs.length
    ? (await db.select().from(projectUpdates).where(inArray(projectUpdates.projectId, projs.map((p) => p.id))).orderBy(desc(projectUpdates.createdAt)))
        .filter((u) => u.visibleToOwner).slice(0, 8)
    : [];
  const UPD_DOT: Record<string, string> = { progress: "bg-info", milestone: "bg-ok", photo: "bg-olive", note: "bg-muted" };

  // Progress updates with media awaiting the owner's decision + sign-off.
  const upIds = updates.map((u) => u.id);
  const upMedia = upIds.length ? await db.select().from(projectMedia).where(inArray(projectMedia.updateId, upIds)).orderBy(asc(projectMedia.sort)) : [];
  const upSign = upIds.length ? await db.select().from(projectSignoffs).where(inArray(projectSignoffs.updateId, upIds)) : [];
  const mByU = new Map<number, typeof upMedia>();
  for (const m of upMedia) { const a = mByU.get(m.updateId) ?? []; a.push(m); mByU.set(m.updateId, a); }
  const sByU = new Map(upSign.map((s) => [s.updateId, s]));
  const approvals: PUpdate[] = updates
    .filter((u) => (mByU.get(u.id) ?? []).length > 0)
    .map((u) => {
      const so = sByU.get(u.id);
      return {
        id: u.id, stage: u.stage ?? u.title, milestone: u.milestone, body: u.body, amount: u.amount ?? 0,
        sentAtISO: (u.sentAt ?? u.createdAt).toISOString(), projectName: projName.get(u.projectId) ?? "",
        media: (mByU.get(u.id) ?? []).map((m) => ({ id: m.id, type: m.type, url: m.url, caption: m.caption, status: m.status, reason: m.reason })),
        signed: !!(so && !so.voidedAt), signoffRef: so && !so.voidedAt ? so.ref : null,
      };
    });

  return (
    <PortalShell owner={owner} active="home">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Your account</p>
        <h1 className="mt-1 font-serif text-4xl">Hello, {owner.name.split(" ")[0]}</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Contracted" value={fmtEGP(sum.contractValue)} />
        <Tile label="Paid" value={fmtEGP(sum.collected)} hint={`${sum.progress}%`} />
        <Tile label="Outstanding" value={fmtEGP(sum.outstanding)} />
        <Tile label="Overdue" value={fmtEGP(sum.overdue)} accent={sum.overdue > 0} />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-bold">Your projects</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {projs.map((pr) => {
            const s = summarize(mine.filter((p) => p.projectId === pr.id), pr.contractValue);
            return (
              <div key={pr.id} className="rounded-2xl border border-line bg-paper p-5">
                <div className="font-bold">{pr.name}</div>
                <div className="mt-1 text-xs text-muted">{pr.status.replace("_", " ")}</div>
                <div className="mt-3 flex items-baseline justify-between text-sm">
                  <span className="text-sub">{fmtEGP(s.collected)} paid</span>
                  <span className="font-bold tabular">{s.progress}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand"><div className="h-full rounded-full bg-ok" style={{ width: `${s.progress}%` }} /></div>
                <div className="mt-2 text-xs text-sub">{fmtEGP(s.outstanding)} outstanding{s.overdue ? ` · ${fmtEGP(s.overdue)} overdue` : ""}</div>
              </div>
            );
          })}
          {projs.length === 0 && <p className="text-sm text-muted">No projects yet.</p>}
        </div>
      </section>

      {approvals.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold">Approve your progress</h2>
          <p className="mb-3 text-xs text-sub">Accept each item, or ask for a re-shoot. When everything is accepted you can sign off the milestone and release its payment.</p>
          <Approvals updates={approvals} />
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Payments to action</h2>
          <Link href="/portal/payments" className="text-xs font-bold text-olive hover:text-ink">All payments →</Link>
        </div>
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-paper">
          {attention.map(({ p, st }) => {
            const m = PAYMENT_STATE_META[st.state];
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{p.label}</div>
                  <div className="text-xs text-muted">{KIND_LABEL[p.kind] ?? p.kind}{p.dueDate ? ` · due ${new Date(p.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}` : ""}</div>
                </div>
                <div className="font-bold tabular">{fmtEGP(p.amount)}</div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${m.chip}`}>{m.label}</span>
                {(st.state === "due" || st.state === "overdue") && <PayButton payment={p} />}
              </div>
            );
          })}
          {attention.length === 0 && <div className="px-5 py-10 text-center text-sm text-muted">You&apos;re all settled up. Thank you!</div>}
        </div>
      </section>

      {updates.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold">Project updates</h2>
          <ol className="mt-3 space-y-4 rounded-2xl border border-line bg-paper p-5">
            {updates.map((u) => (
              <li key={u.id} className="flex gap-3">
                <div className="mt-1 flex flex-col items-center">
                  <span className={`h-2.5 w-2.5 rounded-full ${UPD_DOT[u.kind] ?? "bg-muted"}`} />
                  <span className="mt-1 w-px flex-1 bg-line" />
                </div>
                <div className="flex-1 pb-1">
                  <div className="text-xs text-muted">
                    {projName.get(u.projectId)} · {new Date(u.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                  </div>
                  <div className="mt-0.5 font-semibold">{u.title}</div>
                  {u.body && <p className="mt-0.5 text-sm text-sub">{u.body}</p>}
                  {u.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.image} alt="" className="mt-2 max-h-56 rounded-xl border border-line object-cover" />
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </PortalShell>
  );
}

function Tile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-2 font-serif text-3xl leading-none tabular ${accent ? "text-crit" : ""}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-sub">{hint}</p>}
    </div>
  );
}
