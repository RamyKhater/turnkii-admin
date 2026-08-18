import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { styles } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { Field, Textarea, CheckField, SubmitButton } from "@/components/form";
import { ImageField } from "@/components/content/image-field";
import { updateStyle } from "@/lib/content/actions";

export default async function StyleEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [s] = await db.select().from(styles).where(eq(styles.id, Number(id))).limit(1);
  if (!s) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Design styles"
        title={`Edit · ${s.name}`}
        actions={<Link href="/content/styles" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Styles</Link>}
      />
      <div className="max-w-2xl p-6 lg:p-8">
        <Card className="p-6">
          <form action={updateStyle} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={s.id} />
            <Field label="Name" name="name" defaultValue={s.name} required />
            <Textarea label="Blurb" name="blurb" defaultValue={s.blurb} rows={3} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="From (EGP/m²)" name="fromPrice" defaultValue={s.fromPrice} />
              <Field label="Lead time" name="leadTime" defaultValue={s.leadTime} />
              <Field label="Pieces" name="pieceCount" defaultValue={s.pieceCount} />
            </div>
            <ImageField name="heroImage" label="Hero image" defaultValue={s.heroImage} />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Palette</span>
              <div className="flex flex-wrap gap-2">
                {(s.palette ?? []).map((p) => (
                  <span key={p.hex} className="inline-flex items-center gap-2 rounded-full border border-line px-2.5 py-1 text-xs font-semibold">
                    <span className="h-4 w-4 rounded-full" style={{ background: p.hex }} />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-4">
              <div className="flex items-center gap-4">
                <Field label="Sort" name="sortOrder" type="number" defaultValue={s.sortOrder} />
                <div className="pt-5"><CheckField label="Published" name="published" defaultChecked={s.published} /></div>
              </div>
              <div className="pt-5"><SubmitButton>Save changes</SubmitButton></div>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
