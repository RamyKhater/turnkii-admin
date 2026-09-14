import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { proposals } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";

const STATUS: Record<string, string> = {
  draft: "bg-sand text-sub",
  sent: "bg-info/10 text-info",
  viewed: "bg-lime/20 text-olive",
  approved: "bg-ok/15 text-ok",
  archived: "bg-sand text-muted",
};

export default async function ProposalsPage() {
  await requireCap("proposals:manage");
  const db = await getDb();
  const rows = await db.select().from(proposals).orderBy(desc(proposals.createdAt));

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Proposals"
        sub="Create a design direction for a client and share it via one private link."
        actions={
          <Link href="/proposals/new" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream hover:bg-ink/90">
            + New proposal
          </Link>
        }
      />
      <div className="p-6 lg:p-8">
        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-sub">
              No proposals yet. <Link href="/proposals/new" className="font-semibold text-olive">Create your first one →</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-bold uppercase tracking-wider text-muted">
                  <th className="px-5 py-3">Proposal</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Opened</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-sand/40">
                    <td className="px-5 py-3">
                      <Link href={`/proposals/${r.id}`} className="font-semibold text-ink hover:text-olive">{r.title}</Link>
                    </td>
                    <td className="px-5 py-3 text-sub">{r.clientName ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS[r.status] ?? STATUS.draft}`}>{r.status}</span>
                    </td>
                    <td className="px-5 py-3 text-sub">
                      {r.viewedAt ? r.viewedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                    </td>
                    <td className="px-5 py-3 text-sub">{r.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
