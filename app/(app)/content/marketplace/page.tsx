import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { PageHeader, Card, StatTile } from "@/components/ui";
import { PublishToggle } from "@/components/content/publish-toggle";
import { createProduct } from "@/lib/content/actions";

export default async function MarketplaceList() {
  const db = await getDb();
  const rows = await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id));
  const published = rows.filter((r) => r.published).length;
  const inStock = rows.filter((r) => (r.stock ?? "").toLowerCase() === "in stock").length;
  const categories = new Set(rows.map((r) => r.category).filter(Boolean)).size;

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Marketplace"
        sub="Products delivered with the fit-out or on their own."
        actions={<Link href="/content" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Content</Link>}
      />
      <div className="space-y-4 p-6 lg:p-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Products" value={rows.length} />
          <StatTile label="Published" value={published} hint={`${rows.length - published} hidden`} />
          <StatTile label="In stock" value={inStock} />
          <StatTile label="Categories" value={categories} />
        </div>
        <Card className="p-4">
          <form action={createProduct} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Add a product</span>
              <input name="name" placeholder="e.g. Oak sideboard, 180cm" className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink" />
            </label>
            <button type="submit" className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream hover:bg-lime hover:text-ink">
              Create draft
            </button>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-bold">Product</th>
                  <th className="px-3 py-3 font-bold">Category</th>
                  <th className="px-3 py-3 font-bold">Price</th>
                  <th className="px-3 py-3 font-bold">Stock</th>
                  <th className="px-3 py-3 font-bold">State</th>
                  <th className="px-5 py-3 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <div className="font-bold">{p.name}</div>
                      <div className="max-w-[42ch] truncate text-xs text-muted">{p.spec}</div>
                    </td>
                    <td className="px-3 py-3 text-sub">{p.category}</td>
                    <td className="px-3 py-3 tabular">{p.price}</td>
                    <td className="px-3 py-3 text-sub">{p.stock}</td>
                    <td className="px-3 py-3"><PublishToggle entity="product" id={p.id} published={p.published} /></td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/content/marketplace/${p.id}`} className="text-sm font-bold text-olive hover:text-ink">Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
