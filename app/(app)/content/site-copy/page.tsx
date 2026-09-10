import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contentBlocks } from "@/lib/db/schema";
import { requireCap } from "@/lib/auth/guard";
import { PageHeader, Card } from "@/components/ui";
import { SiteCopyEditor } from "@/components/content/site-copy-editor";

type Manifest = { pages: { slug: string; title: string; keys: string[] }[]; count: number };

// The marketing site publishes copy-manifest.json (every editable string). We
// read it server-side so the editor always reflects the live source.
const MARKETING_URL = (process.env.MARKETING_URL || "https://turnkii.app").replace(/\/$/, "");

export default async function SiteCopyPage() {
  await requireCap("content:edit");
  const db = await getDb();
  const [row] = await db.select().from(contentBlocks).where(eq(contentBlocks.key, "copyOverrides")).limit(1);
  const overrides = (row?.value ?? {}) as Record<string, string>;

  let manifest: Manifest = { pages: [], count: 0 };
  let error: string | null = null;
  try {
    const res = await fetch(`${MARKETING_URL}/copy-manifest.json`, { next: { revalidate: 300 } });
    if (res.ok) manifest = (await res.json()) as Manifest;
    else error = `Couldn't load the copy list from the site (HTTP ${res.status}). It publishes on the next build.`;
  } catch {
    error = "Couldn't reach the marketing site to load the copy list. Try again after the next site build.";
  }

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Site copy"
        sub="Edit any text on the marketing site — headings, body and the footer. Saving rebuilds the live site (about a minute)."
        actions={
          <Link href="/content" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">
            ← Content
          </Link>
        }
      />
      <div className="p-6 lg:p-8">
        {error ? (
          <Card className="p-6 text-sm text-sub">{error}</Card>
        ) : (
          <SiteCopyEditor pages={manifest.pages} overrides={overrides} total={manifest.count} />
        )}
      </div>
    </>
  );
}
