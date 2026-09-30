import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guard";
import { canAccessSection } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { owners, projects, requests } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";

export default async function CustomersPage() {
  const user = await requireUser();
  if (!canAccessSection(user.role, "customers")) redirect("/denied");

  const db = await getDb();
  const rows = await db.select().from(owners).orderBy(desc(owners.createdAt));

  const projCounts = await db
    .select({ ownerId: projects.ownerId, n: sql<number>`count(*)::int` })
    .from(projects)
    .groupBy(projects.ownerId);
  const projByOwner = new Map(projCounts.filter((p) => p.ownerId).map((p) => [p.ownerId as number, p.n]));

  const reqCounts = await db
    .select({ email: sql<string>`lower(${requests.email})`, n: sql<number>`count(*)::int` })
    .from(requests)
    .where(sql`${requests.email} is not null and ${requests.email} <> ''`)
    .groupBy(sql`lower(${requests.email})`);
  const reqByEmail = new Map(reqCounts.map((r) => [r.email, r.n]));

  return (
    <>
      <PageHeader
        eyebrow="Accounts"
        title="Customers"
        sub="Everyone who created a Turnkii account. Open one to edit their details and see all their requests, projects and payments."
      />
      <div className="p-6 lg:p-8">
        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-sub">No customer accounts yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-bold uppercase tracking-wider text-muted">
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-3 py-3">Phone</th>
                    <th className="px-3 py-3">Projects</th>
                    <th className="px-3 py-3">Requests</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-5 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} className="border-b border-line/60 last:border-0 hover:bg-sand/40">
                      <td className="px-5 py-3">
                        <Link href={`/customers/${o.id}`} className="font-semibold text-ink underline decoration-line underline-offset-2 hover:text-olive hover:decoration-olive">{o.name}</Link>
                        <div className="text-xs text-muted">{o.email}</div>
                      </td>
                      <td className="px-3 py-3 text-sub">{o.phone ?? "—"}</td>
                      <td className="px-3 py-3 font-bold tabular">{projByOwner.get(o.id) ?? 0}</td>
                      <td className="px-3 py-3 font-bold tabular">{reqByEmail.get(o.email.toLowerCase()) ?? 0}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${o.active ? "bg-lime/20 text-olive" : "bg-sand text-muted"}`}>
                          {o.active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sub">{o.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
