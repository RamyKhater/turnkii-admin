import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { inspirationShots, styles } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { Field, Textarea, SelectField, CheckField, SubmitButton } from "@/components/form";
import { ImageField } from "@/components/content/image-field";
import { updateInspiration } from "@/lib/content/actions";

export default async function InspirationEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [s] = await db.select().from(inspirationShots).where(eq(inspirationShots.id, Number(id))).limit(1);
  if (!s) notFound();
  const styleRows = await db.select({ key: styles.key, name: styles.name }).from(styles).orderBy(asc(styles.sortOrder));

  return (
    <>
      <PageHeader
        eyebrow="Inspiration board"
        title={`Edit · ${s.title}`}
        actions={<Link href="/content/inspiration" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Inspiration</Link>}
      />
      <div className="max-w-2xl p-6 lg:p-8">
        <Card className="p-6">
          <form action={updateInspiration} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={s.id} />
            <Field label="Title" name="title" defaultValue={s.title} required />
            <Textarea label="Spec" name="spec" defaultValue={s.spec} rows={2} />
            <ImageField name="image" label="Photo" defaultValue={s.image} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Room" name="room" defaultValue={s.room} />
              <SelectField label="Style" name="key" defaultValue={s.key} options={styleRows.map((r) => ({ value: r.key, label: r.name }))} />
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
