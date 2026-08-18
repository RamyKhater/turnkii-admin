import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { handovers } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { Field, CheckField, SubmitButton } from "@/components/form";
import { MediaRepeater } from "@/components/content/media-repeater";
import { DeleteButton } from "@/components/content/delete-button";
import { updateHandover } from "@/lib/content/actions";

export default async function HandoverEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [h] = await db.select().from(handovers).where(eq(handovers.id, Number(id))).limit(1);
  if (!h) notFound();

  const shotItems = (h.shots ?? []).map((url) => ({ image: url }));

  return (
    <>
      <PageHeader
        eyebrow="Recent handovers"
        title={`Edit · ${h.title}`}
        actions={
          <div className="flex items-center gap-4">
            <DeleteButton entity="handover" id={h.id} name={h.title} redirectTo="/content/handovers" />
            <Link href="/content/handovers" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Handovers</Link>
          </div>
        }
      />
      <div className="max-w-2xl p-6 lg:p-8">
        <Card className="p-6">
          <form action={updateHandover} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={h.id} />
            <Field label="Title" name="title" defaultValue={h.title} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Location" name="location" defaultValue={h.location} />
              <Field label="Provider (partner)" name="provider" defaultValue={h.provider} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Partner role" name="role" defaultValue={h.role} />
              <Field label="Badge (2 letters)" name="brandMark" defaultValue={h.brandMark} />
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Badge colour</span>
                <input type="color" name="brandHex" defaultValue={h.brandHex ?? "#2E4A3A"} className="h-11 w-full rounded-xl border border-line bg-paper px-2" />
              </label>
            </div>
            <MediaRepeater name="shots" label="Gallery shots" addLabel="shot" initial={shotItems} />
            <div className="flex items-center justify-between border-t border-line pt-4">
              <div className="flex items-center gap-4">
                <Field label="Sort" name="sortOrder" type="number" defaultValue={h.sortOrder} />
                <div className="pt-5"><CheckField label="Published" name="published" defaultChecked={h.published} /></div>
              </div>
              <div className="pt-5"><SubmitButton>Save changes</SubmitButton></div>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
