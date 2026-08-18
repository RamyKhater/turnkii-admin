import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { inspirationShots, styles } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { PublishToggle } from "@/components/content/publish-toggle";

export default async function InspirationList() {
  const db = await getDb();
  const rows = await db.select().from(inspirationShots).orderBy(asc(inspirationShots.sortOrder), asc(inspirationShots.id));
  const styleRows = await db.select({ key: styles.key, name: styles.name }).from(styles);
  const styleName = new Map(styleRows.map((s) => [s.key, s.name]));

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Inspiration board"
        sub="Delivered-room shots that seed the public board."
        actions={<Link href="/content" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Content</Link>}
      />
      <div className="p-6 lg:p-8">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-bold">Title</th>
                  <th className="px-3 py-3 font-bold">Room</th>
                  <th className="px-3 py-3 font-bold">Style</th>
                  <th className="px-3 py-3 font-bold">State</th>
                  <th className="px-5 py-3 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <div className="font-bold">{s.title}</div>
                      <div className="max-w-[46ch] truncate text-xs text-muted">{s.spec}</div>
                    </td>
                    <td className="px-3 py-3 text-sub">{s.room}</td>
                    <td className="px-3 py-3 text-sub">{styleName.get(s.key ?? "") ?? s.key}</td>
                    <td className="px-3 py-3"><PublishToggle entity="inspiration" id={s.id} published={s.published} /></td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/content/inspiration/${s.id}`} className="text-sm font-bold text-olive hover:text-ink">Edit</Link>
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
