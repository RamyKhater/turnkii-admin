import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { failedSubmissions } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { RecoveryActions } from "@/components/requests/recovery-actions";

export const dynamic = "force-dynamic";

export default async function RecoveryPage() {
  const user = await requireUser();
  if (!can(user.role, "requests:create")) redirect("/denied");

  const db = await getDb();
  const rows = await db.select().from(failedSubmissions).orderBy(desc(failedSubmissions.createdAt)).limit(200);
  const pending = rows.filter((r) => r.status === "pending");
  const handled = rows.filter((r) => r.status !== "pending");
  const dt = (d: Date) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <PageHeader
        eyebrow="Pipeline"
        title="Lead recovery"
        sub="Submissions that failed to save as a request are captured here so none are lost. Recover the real ones; dismiss spam or duplicates."
        actions={<Link href="/requests" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Requests</Link>}
      />
      <div className="space-y-6 p-6 lg:p-8">
        <p className="text-sm text-sub">
          <span className="font-bold text-ink tabular">{pending.length}</span> awaiting recovery
        </p>

        {pending.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted">Nothing to recover — every submission has been saved. 🎉</Card>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => {
              const p = r.payload ?? {};
              const facts = Object.entries(p)
                .filter(([k, v]) => v != null && v !== "" && !/^utm|gclid|fbclid|expEmail/.test(k))
                .slice(0, 12);
              return (
                <Card key={r.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-bold">{r.contactName || "Unknown contact"}</div>
                      <div className="text-xs text-muted">
                        {[r.phone, r.email].filter(Boolean).join(" · ") || "no contact details"} · via {r.route} · {dt(r.createdAt)}
                      </div>
                    </div>
                    <RecoveryActions id={r.id} />
                  </div>
                  {r.error && <div className="mt-2 rounded-lg bg-crit-soft/40 px-3 py-1.5 text-xs text-crit">Blocked by: {r.error}</div>}
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    {facts.map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <dt className="shrink-0 text-xs uppercase tracking-wide text-muted">{k}</dt>
                        <dd className="min-w-0 truncate">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              );
            })}
          </div>
        )}

        {handled.length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-5 py-4"><h2 className="text-sm font-bold">Handled</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-y border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-5 py-3 font-bold">Contact</th>
                    <th className="px-3 py-3 font-bold">Via</th>
                    <th className="px-3 py-3 font-bold">Captured</th>
                    <th className="px-5 py-3 font-bold">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {handled.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3">{r.contactName || "—"}<div className="text-xs text-muted">{r.phone}</div></td>
                      <td className="px-3 py-3 text-sub">{r.route}</td>
                      <td className="px-3 py-3 text-sub tabular">{dt(r.createdAt)}</td>
                      <td className="px-5 py-3">
                        {r.status === "recovered"
                          ? <Link href={`/requests/${r.recoveredRequestId}`} className="font-semibold text-olive hover:text-ink">Recovered →</Link>
                          : <span className="text-muted">Dismissed</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
