import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { Field, Textarea, SelectField, CheckField, SubmitButton } from "@/components/form";
import { ImageField } from "@/components/content/image-field";
import { DeleteButton } from "@/components/content/delete-button";
import { updateProduct } from "@/lib/content/actions";

const CATEGORIES = ["Seating", "Tables", "Beds", "Lighting", "Appliances", "Outdoor", "Soft goods"];
const STOCK = ["In stock", "2 weeks", "3 weeks", "4 weeks", "6 weeks", "8 weeks"];

export default async function ProductEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [p] = await db.select().from(products).where(eq(products.id, Number(id))).limit(1);
  if (!p) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Marketplace"
        title={`Edit · ${p.name}`}
        actions={<Link href="/content/marketplace" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Marketplace</Link>}
      />
      <div className="max-w-2xl p-6 lg:p-8">
        <Card className="p-6">
          <form action={updateProduct} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={p.id} />
            <Field label="Name" name="name" defaultValue={p.name} required />
            <Textarea label="Spec" name="spec" defaultValue={p.spec} rows={2} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Category" name="category" defaultValue={p.category ?? CATEGORIES[0]} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
              <SelectField label="Stock" name="stock" defaultValue={p.stock ?? STOCK[0]} options={STOCK.map((c) => ({ value: c, label: c }))} />
            </div>
            <Field label="Price" name="price" defaultValue={p.price} hint="Free text — e.g. “On request” or “EGP 24,000”." />
            <ImageField name="image" defaultValue={p.image} />
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
              <div className="flex items-center gap-4">
                <div className="w-24"><Field label="Sort" name="sortOrder" type="number" defaultValue={p.sortOrder} /></div>
                <div className="pt-5"><CheckField label="Published" name="published" defaultChecked={p.published} /></div>
              </div>
              <div className="flex items-center gap-4 pt-5">
                <DeleteButton entity="product" id={p.id} name={p.name} redirectTo="/content/marketplace" />
                <SubmitButton>Save changes</SubmitButton>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
