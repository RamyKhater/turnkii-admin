import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { showcases } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { ShowcaseForm } from "@/components/showcases/showcase-form";
import { CopyLink } from "@/components/proposals/copy-link";
import { showcaseUrl } from "@/lib/showcases/link";
import { setShowcaseStatus, deleteShowcase } from "@/lib/showcases/actions";

const STATUS: Record<string, string> = {
  draft: "bg-sand text-sub",
  shared: "bg-info/10 text-info",
  viewed: "bg-lime/20 text-olive",
  archived: "bg-sand text-muted",
};

export default async function ShowcaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCap("showcases:manage");
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) notFound();

  const db = await getDb();
  const [s] = await db.select().from(showcases).where(eq(showcases.id, id)).limit(1);
  if (!s) notFound();

  const url = showcaseUrl(s.token);
  const fmt = (d: Date | null) => (d ? d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : null);

  return (
    <>
      <PageHeader
        eyebrow="Sample work"
        title={s.title}
        sub={s.subtitle ?? undefined}
        actions={<span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS[s.status] ?? STATUS.draft}`}>{s.status}</span>}
      />

      <div className="p-6 lg:p-8">
        <Card className="p-6">
          <h2 className="text-sm font-bold">Private share link</h2>
          <p className="mt-1 text-sm text-sub">One unguessable link, generated once. It opens a zoomable, hidden page — not indexed or listed.</p>
          <div className="mt-4"><CopyLink url={url} /></div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Status</span>
            {s.status !== "shared" && (
              <form action={setShowcaseStatus}>
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="shared" />
                <button className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream hover:bg-ink/90">Mark as shared</button>
              </form>
            )}
            {s.status !== "draft" && (
              <form action={setShowcaseStatus}>
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="draft" />
                <button className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:border-ink">Back to draft</button>
              </form>
            )}
            {s.status !== "archived" && (
              <form action={setShowcaseStatus}>
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="archived" />
                <button className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-crit hover:border-crit">Archive</button>
              </form>
            )}
            {fmt(s.viewedAt) && <span className="ml-auto text-xs text-sub">Opened {fmt(s.viewedAt)}</span>}
          </div>
          {s.status === "archived" && <p className="mt-3 text-xs text-crit">Archived — the link now returns “not found”.</p>}
        </Card>
      </div>

      <ShowcaseForm showcase={s} />

      <div className="px-6 pb-10 lg:px-8">
        <form action={deleteShowcase} className="border-t border-line pt-5">
          <input type="hidden" name="id" value={s.id} />
          <button className="text-sm font-semibold text-crit hover:underline">Delete this showcase permanently</button>
        </form>
      </div>
    </>
  );
}
