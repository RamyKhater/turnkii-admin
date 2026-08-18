import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { services } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { Field, Textarea, CheckField, SubmitButton } from "@/components/form";
import { ImageField } from "@/components/content/image-field";
import { DeleteButton } from "@/components/content/delete-button";
import { updateService } from "@/lib/content/actions";

export default async function ServiceEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [s] = await db.select().from(services).where(eq(services.id, Number(id))).limit(1);
  if (!s) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Services"
        title={`Edit · ${s.name}`}
        actions={<Link href="/content/services" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Services</Link>}
      />
      <div className="max-w-2xl p-6 lg:p-8">
        <Card className="p-6">
          <form action={updateService} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={s.id} />
            <Field label="Name" name="name" defaultValue={s.name} required />
            <Field label="Short line" name="short" defaultValue={s.short} hint="One sentence shown on the service tile." />
            <Textarea label="Description" name="description" defaultValue={s.description} rows={3} />
            <ImageField name="image" defaultValue={s.image} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Lead time" name="lead" defaultValue={s.lead} />
              <Field label="From (EGP/m²)" name="priceFrom" defaultValue={s.priceFrom} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
              <div className="flex items-center gap-5">
                <div className="w-24"><Field label="Sort" name="sortOrder" type="number" defaultValue={s.sortOrder} /></div>
                <div className="flex flex-col gap-2 pt-5">
                  <CheckField label="Published" name="published" defaultChecked={s.published} />
                  <CheckField label="Vertical enabled on site" name="enabled" defaultChecked={s.enabled} />
                </div>
              </div>
              <div className="flex items-center gap-4 pt-5">
                <DeleteButton entity="service" id={s.id} name={s.name} redirectTo="/content/services" />
                <SubmitButton>Save changes</SubmitButton>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
