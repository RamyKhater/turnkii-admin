import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { handovers } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { PublishToggle } from "@/components/content/publish-toggle";
import { DeleteButton } from "@/components/content/delete-button";
import { createHandover } from "@/lib/content/actions";

export default async function HandoversList() {
  const db = await getDb();
  const rows = await db.select().from(handovers).orderBy(asc(handovers.sortOrder), asc(handovers.id));

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Recent handovers"
        sub="The delivered-projects gallery on the home page, with named partner suppliers."
        actions={<Link href="/content" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Content</Link>}
      />
      <div className="space-y-4 p-6 lg:p-8">
        <Card className="p-4">
          <form action={createHandover} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Add a handover</span>
              <input name="title" placeholder="e.g. Penthouse full fit-out" className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink" />
            </label>
            <button type="submit" className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream hover:bg-lime hover:text-ink">Create draft</button>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-bold">Project</th>
                  <th className="px-3 py-3 font-bold">Location</th>
                  <th className="px-3 py-3 font-bold">Partner</th>
                  <th className="px-3 py-3 font-bold">Shots</th>
                  <th className="px-3 py-3 font-bold">State</th>
                  <th className="px-5 py-3 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-3 font-bold">{h.title}</td>
                    <td className="px-3 py-3 text-sub">{h.location}</td>
                    <td className="px-3 py-3 text-sub">{h.provider}</td>
                    <td className="px-3 py-3 tabular">{(h.shots ?? []).length}</td>
                    <td className="px-3 py-3"><PublishToggle entity="handover" id={h.id} published={h.published} /></td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-4">
                        <Link href={`/content/handovers/${h.id}`} className="text-sm font-bold text-olive hover:text-ink">Edit</Link>
                        <DeleteButton entity="handover" id={h.id} name={h.title} />
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-muted">No handovers yet — add one above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
