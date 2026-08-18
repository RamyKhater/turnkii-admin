import { asc } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { properties, styles, payments, projects } from "@/lib/db/schema";
import { PageHeader, Card, StatTile, Avatar } from "@/components/ui";
import { PropertyStatusSelect } from "@/components/properties/status-select";
import { createProperty } from "@/lib/properties/actions";
import { fmtEGP, summarize } from "@/lib/payments";

const STATUS_CHIP: Record<string, string> = {
  active: "bg-info/10 text-info", in_progress: "bg-warn/15 text-warn",
  handed_over: "bg-ok/12 text-ok", on_hold: "bg-crit/10 text-crit",
};

export default async function PropertiesPage() {
  const user = await requireCap("properties:view");
  const editable = can(user.role, "properties:edit");
  const db = await getDb();
  const rows = await db.select().from(properties).orderBy(asc(properties.name));
  const styleRows = await db.select({ key: styles.key, name: styles.name }).from(styles);
  const styleName = new Map(styleRows.map((s) => [s.key, s.name]));

  // property-level payment rollup
  const payRows = await db.select().from(payments);
  const projRows = await db.select({ id: projects.id, propertyId: projects.propertyId, contractValue: projects.contractValue }).from(projects);
  const summaryFor = (propId: number) => {
    const contract = projRows.filter((p) => p.propertyId === propId).reduce((a, p) => a + p.contractValue, 0);
    return summarize(payRows.filter((p) => p.propertyId === propId), contract);
  };
  const totalOutstanding = rows.reduce((a, p) => a + summaryFor(p.id).outstanding, 0);

  const owners = new Set(rows.map((r) => r.ownerEmail || r.ownerName).filter(Boolean));
  const byStatus = ["active", "in_progress", "handed_over", "on_hold"].map((s) => ({
    s, n: rows.filter((r) => r.status === s).length,
  }));
  const totalUnits = rows.reduce((a, r) => a + (r.units ?? 0), 0);

  return (
    <>
      <PageHeader eyebrow="Portfolio" title="Properties" sub="Units under management, with owner details and status." />
      <div className="space-y-5 p-6 lg:p-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Properties" value={rows.length} hint={`${totalUnits} units · ${owners.size} owners`} />
          <StatTile label="Outstanding" value={fmtEGP(totalOutstanding)} hint="across all properties" />
          <StatTile label="In progress" value={byStatus.find((b) => b.s === "in_progress")?.n ?? 0} />
          <StatTile label="Handed over" value={byStatus.find((b) => b.s === "handed_over")?.n ?? 0} />
        </div>

        {editable && (
          <Card className="p-4">
            <form action={createProperty} className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Property</span>
                <input name="name" placeholder="Compound · Unit" required className="w-56 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Owner</span>
                <input name="ownerName" placeholder="Owner name" className="w-44 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Phone</span>
                <input name="ownerPhone" placeholder="+20…" className="w-40 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink" />
              </label>
              <button type="submit" className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream hover:bg-lime hover:text-ink">Add property</button>
            </form>
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-bold">Property</th>
                  <th className="px-3 py-3 font-bold">Owner</th>
                  <th className="px-3 py-3 font-bold">Type</th>
                  <th className="px-3 py-3 font-bold">Style</th>
                  <th className="px-3 py-3 font-bold">Payments</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <div className="font-bold">{p.name}</div>
                      <div className="text-xs text-muted">{p.location} · {p.area}m² · {p.units} unit{p.units === 1 ? "" : "s"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={p.ownerName ?? "?"} />
                        <div>
                          <div className="font-semibold">{p.ownerName}</div>
                          <div className="text-xs text-muted">{p.ownerPhone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sub">{p.type}</td>
                    <td className="px-3 py-3 text-sub">{p.style ? styleName.get(p.style) ?? p.style : "—"}</td>
                    <td className="px-3 py-3">
                      {(() => {
                        const s = summaryFor(p.id);
                        if (!s.contractValue) return <span className="text-xs text-muted">—</span>;
                        return (
                          <div className="min-w-[120px]">
                            <div className="text-xs text-sub tabular">{fmtEGP(s.collected)} <span className="text-muted">/ {fmtEGP(s.contractValue)}</span></div>
                            <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-sand"><div className="h-full rounded-full bg-ok" style={{ width: `${s.progress}%` }} /></div>
                            {s.overdue > 0 && <div className="mt-1 text-xs font-bold text-crit">{fmtEGP(s.overdue)} overdue</div>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3">
                      {editable ? (
                        <PropertyStatusSelect id={p.id} status={p.status} />
                      ) : (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CHIP[p.status] ?? "bg-sand text-muted"}`}>{p.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
