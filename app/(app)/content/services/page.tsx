import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { services } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { PublishToggle } from "@/components/content/publish-toggle";
import { createService } from "@/lib/content/actions";

export default async function ServicesList() {
  const db = await getDb();
  const rows = await db.select().from(services).orderBy(asc(services.sortOrder), asc(services.id));

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Services"
        sub="What Turnkii offers — shown on the site and pickable in the brief."
        actions={<Link href="/content" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Content</Link>}
      />
      <div className="space-y-4 p-6 lg:p-8">
        <Card className="p-4">
          <form action={createService} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Add a service</span>
              <input name="name" placeholder="e.g. Smart home & automation" className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink" />
            </label>
            <button type="submit" className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream hover:bg-lime hover:text-ink">Create draft</button>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-bold">Service</th>
                  <th className="px-3 py-3 font-bold">Lead</th>
                  <th className="px-3 py-3 font-bold">From</th>
                  <th className="px-3 py-3 font-bold">Vertical</th>
                  <th className="px-3 py-3 font-bold">State</th>
                  <th className="px-5 py-3 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <div className="font-bold">{s.name}</div>
                      <div className="max-w-[46ch] truncate text-xs text-muted">{s.short}</div>
                    </td>
                    <td className="px-3 py-3 text-sub">{s.lead}</td>
                    <td className="px-3 py-3 tabular">{s.priceFrom}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.enabled ? "bg-ok/12 text-ok" : "bg-crit/10 text-crit"}`}>
                        {s.enabled ? "On" : "Off"}
                      </span>
                    </td>
                    <td className="px-3 py-3"><PublishToggle entity="service" id={s.id} published={s.published} /></td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/content/services/${s.id}`} className="text-sm font-bold text-olive hover:text-ink">Edit</Link>
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
