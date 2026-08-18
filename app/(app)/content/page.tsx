import Link from "next/link";
import { sql, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { styles, products, inspirationShots, services, contentBlocks, handovers } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { PublishButton } from "@/components/content/publish-button";

async function count(table: typeof styles | typeof products | typeof inspirationShots | typeof services | typeof handovers) {
  const db = await getDb();
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(table);
  const [p] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(table)
    .where(sql`published = true`);
  return { total: r.n, published: p.n };
}

export default async function ContentHub() {
  const db = await getDb();
  const [st, pr, ins, sv, ho, pub] = await Promise.all([
    count(styles), count(products), count(inspirationShots), count(services), count(handovers),
    db.select().from(contentBlocks).where(eq(contentBlocks.key, "__published")).limit(1),
  ]);
  const lastPublished = ((pub[0]?.value as { at?: string } | undefined)?.at) ?? null;

  const sections = [
    { href: "/content/services", title: "Services", desc: "What Turnkii offers — tiles and brief options.", ...sv },
    { href: "/content/styles", title: "Design styles", desc: "Names, blurbs, palettes and pricing for the five costed styles.", ...st },
    { href: "/content/marketplace", title: "Marketplace", desc: "Products — names, specs, categories, price and stock.", ...pr },
    { href: "/content/inspiration", title: "Inspiration board", desc: "Shots — titles, specs, room tags and style.", ...ins },
    { href: "/content/handovers", title: "Recent handovers", desc: "Delivered-project gallery with partner suppliers.", ...ho },
    { href: "/content/copy", title: "Marketing copy", desc: "Landing hero and headline stats.", total: 2, published: 2 },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Site content"
        sub="Everything the public Turnkii site renders. Changes here are the source of truth."
        actions={<PublishButton lastPublished={lastPublished} />}
      />
      <div className="px-6 pt-6 lg:px-8">
        <Card className="flex items-start gap-3 border-olive/30 bg-sand/60 p-4 text-sm text-sub">
          <span aria-hidden className="text-base">↗</span>
          <p>
            Every change you save here <b className="text-ink">publishes to the live site automatically</b> and
            rebuilds turnkii.app (about a minute). Use <b className="text-ink">Publish to website</b> to force a
            rebuild, e.g. after toggling sections in Settings.
          </p>
        </Card>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:p-8">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full p-6 transition-colors hover:border-ink">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-2xl">{s.title}</h2>
                <span className="rounded-full bg-sand px-2.5 py-1 text-xs font-bold text-sub tabular">
                  {s.published}/{s.total} live
                </span>
              </div>
              <p className="mt-2 text-sm text-sub">{s.desc}</p>
              <span className="mt-4 inline-block text-sm font-bold text-olive">Manage →</span>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
