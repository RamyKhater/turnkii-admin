import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { estimates } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";
const egp = (n: number | null) => (n == null ? "—" : "EGP " + Math.round(n).toLocaleString("en-US"));
const STATUS: Record<string, string> = {
  requested: "bg-sand text-muted", drafting: "bg-sand text-muted",
  confirmed: "bg-lime text-ink", published: "bg-ok/15 text-ok", declined: "bg-crit/12 text-crit",
};

export default async function EstimatesList() {
  const user = await requireUser();
  if (!can(user.role, "estimates:request") && !can(user.role, "estimates:signoff")) redirect("/denied");
  const db = await getDb();
  const rows = await db.select().from(estimates).orderBy(desc(estimates.createdAt)).limit(200);
  const open = rows.filter((e) => e.status !== "published" && e.status !== "declined");
  const dt = (d: Date | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <>
      <PageHeader eyebrow="Pipeline" title="Estimates"
        sub="Costed-estimate requests and their 24-hour clock."
        actions={can(user.role, "settings:manage") ? <Link href="/estimates/settings" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">Engine settings</Link> : null} />
      <div className="p-6 lg:p-8">
        <p className="mb-3 text-sm text-sub"><span className="font-bold text-ink tabular">{open.length}</span> open · {rows.length} total</p>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm tabular-nums">
              <thead><tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3">Ref</th><th className="px-3 py-3">Auto-cost</th><th className="px-3 py-3">Confirmed</th><th className="px-3 py-3">SLA due</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody>
                {rows.map((e) => {
                  const overdue = e.slaDueAt && new Date(e.slaDueAt).getTime() < Date.now() && e.status !== "published" && e.status !== "declined";
                  return (
                    <tr key={e.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                      <td className="px-5 py-3"><Link href={e.requestId ? `/requests/${e.requestId}` : "#"} className="font-bold text-ink hover:text-olive">{e.ref}</Link>{e.tier && <div className="text-xs text-muted capitalize">{e.tier}</div>}</td>
                      <td className="px-3 py-3 text-sub">{egp(e.autoQuotation)}</td>
                      <td className="px-3 py-3 font-semibold">{egp(e.confirmedQuotation)}</td>
                      <td className={`px-3 py-3 ${overdue ? "font-bold text-crit" : "text-sub"}`}>{dt(e.slaDueAt)}{overdue ? " · overdue" : ""}</td>
                      <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[e.status] ?? "bg-sand text-muted"}`}>{e.status}</span></td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-muted">No estimate requests yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
