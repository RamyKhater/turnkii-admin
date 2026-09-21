import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { projectShowcases } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { ProjectShowcaseForm } from "@/components/project-showcases/project-showcase-form";
import { CopyLink } from "@/components/proposals/copy-link";
import { projectShowcaseUrl } from "@/lib/project-showcases/link";
import { setProjectShowcaseStatus, deleteProjectShowcase, setProjectShowcaseFeatured } from "@/lib/project-showcases/actions";

const STATUS: Record<string, string> = {
  draft: "bg-sand text-sub", shared: "bg-info/10 text-info", viewed: "bg-lime/20 text-olive", archived: "bg-sand text-muted",
};

export default async function ProjectShowcaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCap("showcases:manage");
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) notFound();

  const db = await getDb();
  const [s] = await db.select().from(projectShowcases).where(eq(projectShowcases.id, id)).limit(1);
  if (!s) notFound();

  const url = projectShowcaseUrl(s.token);
  const fmt = (d: Date | null) => (d ? d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : null);

  return (
    <>
      <PageHeader
        eyebrow="Project showcase"
        title={s.title}
        sub={s.subtitle ?? undefined}
        actions={<span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS[s.status] ?? STATUS.draft}`}>{s.status}</span>}
      />
      <div className="p-6 lg:p-8">
        <Card className="p-6">
          <h2 className="text-sm font-bold">Private share link</h2>
          <p className="mt-1 text-sm text-sub">One unguessable link, generated once. It opens a sectioned, zoomable page — not indexed or listed.</p>
          <div className="mt-4"><CopyLink url={url} /></div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Status</span>
            {s.status !== "shared" && (
              <form action={setProjectShowcaseStatus}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="shared" /><button className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream hover:bg-ink/90">Mark as shared</button></form>
            )}
            {s.status !== "draft" && (
              <form action={setProjectShowcaseStatus}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="draft" /><button className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:border-ink">Back to draft</button></form>
            )}
            {s.status !== "archived" && (
              <form action={setProjectShowcaseStatus}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="archived" /><button className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-crit hover:border-crit">Archive</button></form>
            )}
            {fmt(s.viewedAt) && <span className="ml-auto text-xs text-sub">Opened {fmt(s.viewedAt)}</span>}
          </div>
          {s.status === "archived" && <p className="mt-3 text-xs text-crit">Archived — the link now returns “not found”.</p>}
        </Card>

        <Card className="mt-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold">Show on the homepage</h2>
              <p className="mt-1 text-sm text-sub">Add this project's images to the public “our recent work” gallery on turnkii.app, grouped by service with supplier logos. Publishes on save.</p>
            </div>
            <form action={setProjectShowcaseFeatured}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="featured" value={s.featured ? "false" : "true"} />
              <button className={`rounded-full px-5 py-2.5 text-sm font-semibold ${s.featured ? "border border-line hover:border-ink" : "bg-olive text-cream hover:bg-olive/90"}`}>
                {s.featured ? "On homepage · Remove" : "Show on homepage"}
              </button>
            </form>
          </div>
          {s.featured && <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-lime/20 px-3 py-1 text-xs font-bold text-olive">● Live on turnkii.app</p>}
        </Card>
      </div>

      <ProjectShowcaseForm showcase={s} />

      <div className="px-6 pb-10 lg:px-8">
        <form action={deleteProjectShowcase} className="border-t border-line pt-5">
          <input type="hidden" name="id" value={s.id} />
          <button className="text-sm font-semibold text-crit hover:underline">Delete this showcase permanently</button>
        </form>
      </div>
    </>
  );
}
