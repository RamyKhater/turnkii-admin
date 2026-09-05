import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, isNotNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guard";
import { canAccessSection } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { referrers, requests, siteSettings } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";

const egp = (v: number) => "EGP " + Math.round(v).toLocaleString("en-US");

export default async function ReferralsPage() {
  const user = await requireUser();
  if (!canAccessSection(user.role, "requests")) redirect("/denied");

  const db = await getDb();
  const [refs, referred, settings] = await Promise.all([
    db.select().from(referrers).orderBy(desc(referrers.createdAt)),
    db.select({ code: requests.referredByCode, status: requests.status, id: requests.id })
      .from(requests).where(isNotNull(requests.referredByCode)),
    db.select().from(siteSettings),
  ]);
  const creditEGP = Number(settings.find((s) => s.key === "referral.creditEGP")?.value ?? 5000);

  // group referred leads by code
  const byCode = new Map<string, { leads: number; won: number }>();
  for (const r of referred) {
    const code = r.code as string;
    const g = byCode.get(code) ?? { leads: 0, won: 0 };
    g.leads += 1;
    if (r.status === "won") g.won += 1;
    byCode.set(code, g);
  }

  const rows = refs.map((r) => {
    const g = byCode.get(r.code) ?? { leads: 0, won: 0 };
    return { ...r, leads: g.leads, won: g.won, credit: g.won * creditEGP };
  }).sort((a, b) => b.credit - a.credit || b.leads - a.leads);

  const totals = rows.reduce((t, r) => ({ leads: t.leads + r.leads, won: t.won + r.won, credit: t.credit + r.credit }), { leads: 0, won: 0, credit: 0 });

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Referrals"
        sub={`Each referrer earns ${egp(creditEGP)} off their own fit-out when a lead they sent signs a contract. Set the amount in Settings.`}
      />
      <div className="p-6 lg:p-8 space-y-5">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ["Referrers", rows.length.toString()],
            ["Referred leads", totals.leads.toString()],
            ["Signed (won)", totals.won.toString()],
            ["Credit earned", egp(totals.credit)],
          ].map(([label, value]) => (
            <Card key={label} className="p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-muted">{label}</div>
              <div className="mt-1 font-serif text-3xl">{value}</div>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-bold">Referrer</th>
                  <th className="px-3 py-3 font-bold">Code</th>
                  <th className="px-3 py-3 font-bold">Leads sent</th>
                  <th className="px-3 py-3 font-bold">Signed</th>
                  <th className="px-3 py-3 font-bold">Credit due</th>
                  <th className="px-5 py-3 font-bold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-xs text-muted">{r.phone}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/requests?q=${encodeURIComponent(r.code)}`} className="rounded-full bg-sand px-2.5 py-1 font-mono text-xs font-bold text-ink hover:bg-lime">{r.code}</Link>
                    </td>
                    <td className="px-3 py-3 tabular font-semibold">{r.leads}</td>
                    <td className="px-3 py-3 tabular font-semibold text-ok">{r.won}</td>
                    <td className="px-3 py-3 tabular font-bold">{r.credit ? egp(r.credit) : "—"}</td>
                    <td className="px-5 py-3 text-sub tabular">{r.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-muted">No referrers yet. They appear here once someone creates a referral link on the site.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="text-xs text-muted">A referred lead is tagged with the referrer’s code on intake. Credit accrues automatically when you move that request to <b>Won</b> (contract signed).</p>
      </div>
    </>
  );
}
