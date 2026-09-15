import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { proposals, requests } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { ProposalForm } from "@/components/proposals/proposal-form";
import { CopyLink } from "@/components/proposals/copy-link";
import { proposalUrl } from "@/lib/proposals/link";
import { setProposalStatus, deleteProposal } from "@/lib/proposals/actions";

const STATUS: Record<string, string> = {
  draft: "bg-sand text-sub",
  sent: "bg-info/10 text-info",
  viewed: "bg-lime/20 text-olive",
  approved: "bg-ok/15 text-ok",
  archived: "bg-sand text-muted",
};

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCap("proposals:manage");
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) notFound();

  const db = await getDb();
  const [p] = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  if (!p) notFound();

  const scope = can(user.role, "requests:view_all") ? undefined : eq(requests.assignedTo, user.id);
  const reqRows = await db
    .select({ id: requests.id, ref: requests.ref, contactName: requests.contactName })
    .from(requests)
    .where(scope)
    .orderBy(desc(requests.createdAt))
    .limit(200);
  const linkedRequest = p.requestId ? reqRows.find((r) => r.id === p.requestId) : null;

  const url = proposalUrl(p.token);
  const fmt = (d: Date | null) => (d ? d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : null);

  return (
    <>
      <PageHeader
        eyebrow="Proposal"
        title={p.title}
        sub={p.clientName ?? undefined}
        actions={
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS[p.status] ?? STATUS.draft}`}>{p.status}</span>
        }
      />

      <div className="p-6 lg:p-8">
        <Card className="p-6">
          <h2 className="text-sm font-bold">Private share link</h2>
          <p className="mt-1 text-sm text-sub">
            One unguessable link, generated once. Anyone with it can view the proposal; it's a hidden page, not indexed or listed.
          </p>
          <div className="mt-4">
            <CopyLink url={url} />
          </div>

          {p.requestId && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Linked request</span>
              <Link href={`/requests/${p.requestId}`} className="rounded-full bg-sand px-3 py-1 font-semibold text-ink hover:text-olive">
                {linkedRequest ? `${linkedRequest.ref}${linkedRequest.contactName ? ` · ${linkedRequest.contactName}` : ""}` : `Request #${p.requestId}`} →
              </Link>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Status</span>
            {p.status !== "sent" && p.status !== "approved" && (
              <form action={setProposalStatus}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="status" value="sent" />
                <button className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream hover:bg-ink/90">Mark as sent</button>
              </form>
            )}
            {p.status !== "draft" && p.status !== "approved" && (
              <form action={setProposalStatus}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="status" value="draft" />
                <button className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:border-ink">Back to draft</button>
              </form>
            )}
            {p.status !== "archived" && (
              <form action={setProposalStatus}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="status" value="archived" />
                <button className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-crit hover:border-crit">Archive</button>
              </form>
            )}
            <div className="ml-auto flex flex-wrap gap-x-5 gap-y-1 text-xs text-sub">
              {fmt(p.viewedAt) && <span>Opened {fmt(p.viewedAt)}</span>}
              {fmt(p.approvedAt) && <span className="font-semibold text-ok">Approved {fmt(p.approvedAt)}</span>}
            </div>
          </div>
          {p.status === "archived" && (
            <p className="mt-3 text-xs text-crit">Archived — the link now returns “not found” to anyone who opens it.</p>
          )}
        </Card>
      </div>

      <ProposalForm proposal={p} requests={reqRows} />

      <div className="px-6 pb-10 lg:px-8">
        <form action={deleteProposal} className="border-t border-line pt-5">
          <input type="hidden" name="id" value={p.id} />
          <button className="text-sm font-semibold text-crit hover:underline">Delete this proposal permanently</button>
        </form>
      </div>
    </>
  );
}
