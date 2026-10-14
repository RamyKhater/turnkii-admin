import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { styles } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { Field, Textarea, CheckField, SubmitButton } from "@/components/form";
import { ImageField } from "@/components/content/image-field";
import { MediaRepeater } from "@/components/content/media-repeater";
import { MaterialsEditor } from "@/components/content/materials-editor";
import { RowRepeater } from "@/components/content/row-repeater";
import { DeleteButton } from "@/components/content/delete-button";
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
        actions={
          <div className="flex items-center gap-4">
            <DeleteButton entity="style" id={s.id} name={s.name} redirectTo="/content/styles" />
            <Link href="/content/styles" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Styles</Link>
          </div>
        }
      />
      <div className="max-w-3xl p-6 lg:p-8">
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
            <MediaRepeater
              name="closeups"
              label="Close-ups"
              addLabel="close-up"
              textFields={[
                { key: "label", label: "Label", placeholder: "e.g. Bouclé weave" },
                { key: "note", label: "Note", placeholder: "e.g. Sofa upholstery" },
              ]}
              initial={(s.closeups ?? []) as Record<string, string>[]}
            />
            <RowRepeater
              name="palette"
              label="Palette"
              addLabel="swatch"
              fields={[
                { key: "hex", label: "Colour", type: "color" },
                { key: "name", label: "Swatch name (e.g. Sand)" },
              ]}
              initial={(s.palette ?? []) as Record<string, string>[]}
            />
            <MaterialsEditor name="materials" initial={s.materials ?? []} />
            <RowRepeater
              name="furniture"
              label="Furniture list"
              addLabel="item"
              fields={[
                { key: "room", label: "Room", width: "basis-28" },
                { key: "item", label: "Item" },
                { key: "spec", label: "Spec" },
                { key: "qty", label: "Qty", width: "basis-20" },
              ]}
              initial={(s.furniture ?? []) as Record<string, string>[]}
            />
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
