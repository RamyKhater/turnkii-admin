import Link from "next/link";
import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contentBlocks } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { Field, Textarea, SubmitButton } from "@/components/form";
import { saveCopy } from "@/lib/content/actions";

type Hero = { kicker?: string; headline?: string; sub?: string };
type Stat = { n?: string; label?: string };

export default async function CopyEditor() {
  const db = await getDb();
  const blocks = await db.select().from(contentBlocks).where(inArray(contentBlocks.key, ["hero", "stats"]));
  const hero = (blocks.find((b) => b.key === "hero")?.value ?? {}) as Hero;
  const stats = (blocks.find((b) => b.key === "stats")?.value ?? []) as Stat[];
  const rows: Stat[] = [0, 1, 2, 3].map((i) => stats[i] ?? { n: "", label: "" });

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Marketing copy"
        sub="The landing hero and the headline stats row."
        actions={<Link href="/content" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Content</Link>}
      />
      <div className="max-w-2xl p-6 lg:p-8">
        <form action={saveCopy} className="space-y-4">
          <Card className="space-y-4 p-6">
            <h2 className="text-sm font-bold">Hero</h2>
            <Field label="Kicker" name="kicker" defaultValue={hero.kicker} />
            <Textarea label="Headline" name="headline" defaultValue={hero.headline} rows={2} />
            <Textarea label="Sub-headline" name="sub" defaultValue={hero.sub} rows={3} />
          </Card>

          <Card className="space-y-3 p-6">
            <h2 className="text-sm font-bold">Headline stats</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((s, i) => (
                <div key={i} className="flex gap-2 rounded-xl border border-line p-3">
                  <div className="w-24">
                    <Field label="Figure" name={`stat_n_${i}`} defaultValue={s.n} />
                  </div>
                  <div className="flex-1">
                    <Field label="Label" name={`stat_label_${i}`} defaultValue={s.label} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <SubmitButton>Save copy</SubmitButton>
        </form>
      </div>
    </>
  );
}
