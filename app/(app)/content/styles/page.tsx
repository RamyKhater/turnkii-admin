import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { styles } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { PublishToggle } from "@/components/content/publish-toggle";

export default async function StylesList() {
  const db = await getDb();
  const rows = await db.select().from(styles).orderBy(asc(styles.sortOrder));

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Design styles"
        sub="The five costed directions shown on the site."
        actions={<Link href="/content" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Content</Link>}
      />
      <div className="p-6 lg:p-8">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-bold">Style</th>
                  <th className="px-3 py-3 font-bold">Palette</th>
                  <th className="px-3 py-3 font-bold">From (EGP/m²)</th>
                  <th className="px-3 py-3 font-bold">Lead</th>
                  <th className="px-3 py-3 font-bold">State</th>
                  <th className="px-5 py-3 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <div className="font-bold">{s.name}</div>
                      <div className="max-w-[42ch] truncate text-xs text-muted">{s.blurb}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        {(s.palette ?? []).map((p) => (
                          <span key={p.hex} title={p.name} className="h-5 w-5 rounded-full border border-line" style={{ background: p.hex }} />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular">{s.fromPrice}</td>
                    <td className="px-3 py-3 text-sub">{s.leadTime}</td>
                    <td className="px-3 py-3"><PublishToggle entity="style" id={s.id} published={s.published} /></td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/content/styles/${s.id}`} className="text-sm font-bold text-olive hover:text-ink">Edit</Link>
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
