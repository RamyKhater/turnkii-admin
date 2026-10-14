import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contentBlocks } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { Field, Textarea, SubmitButton } from "@/components/form";
import { MediaRepeater } from "@/components/content/media-repeater";
import { updateWhy } from "@/lib/content/actions";

type WhyRow = { image?: string; title?: string; body?: string; icon?: string };
type Why = { eyebrow?: string; headline?: string; rows?: WhyRow[] };

// The site's built-in defaults — shown when the admin hasn't customised the
// section yet, so editing starts from the current live content.
const DEFAULT: Required<Why> = {
  eyebrow: "Why Turnkii",
  headline: "Finishing is easy to picture. Hard to manage from afar.",
  rows: [
    { title: "Paying before you see the work feels risky. So you don’t.", body: "A quantity-backed price, fixed at signature. Each milestone is paid only after you approve the photos and sign off.", image: "", icon: "shield" },
    { title: "Six trades mean six excuses. We take one contract.", body: "Finishing, kitchens, HVAC, furniture, curtains and styling — handed over to the last detail, ready to live in or let.", image: "", icon: "link" },
    { title: "You can’t be on site. You don’t need to be.", body: "Live video survey, weekly photo and video updates and digital sign-off. Supervise every stage from anywhere.", image: "", icon: "globe" },
  ],
};

const ICONS = ["shield", "link", "globe", "check", "home", "clock", "camera", "spark"];

export default async function WhyEditor() {
  const db = await getDb();
  const [row] = await db.select().from(contentBlocks).where(eq(contentBlocks.key, "why")).limit(1);
  const saved = (row?.value ?? null) as Why | null;
  const why: Required<Why> = {
    eyebrow: saved?.eyebrow ?? DEFAULT.eyebrow,
    headline: saved?.headline ?? DEFAULT.headline,
    rows: saved?.rows && saved.rows.length ? saved.rows : DEFAULT.rows,
  };

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Why Turnkii"
        sub="The homepage “Why Turnkii” section — eyebrow, headline and the three rows. Saving rebuilds the live site (about a minute)."
        actions={<Link href="/content" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Content</Link>}
      />
      <div className="max-w-2xl p-6 lg:p-8">
        <form action={updateWhy} className="space-y-4">
          <Card className="space-y-4 p-6">
            <Field label="Eyebrow" name="eyebrow" defaultValue={why.eyebrow} />
            <Textarea label="Headline" name="headline" defaultValue={why.headline} rows={2} />
          </Card>
          <Card className="space-y-3 p-6">
            <h2 className="text-sm font-bold">Rows</h2>
            <p className="-mt-1 text-xs text-muted">
              Each row shows an image, a lime icon chip, a title and body. Leave the image empty to keep the built-in
              photo. Icon is a preset name: {ICONS.join(", ")}.
            </p>
            <MediaRepeater
              name="rows"
              label=""
              addLabel="row"
              textFields={[
                { key: "title", label: "Title", placeholder: "e.g. Priced before you commit" },
                { key: "body", label: "Body", placeholder: "One or two sentences" },
                { key: "icon", label: "Icon", placeholder: "shield", options: ICONS },
              ]}
              initial={why.rows as Record<string, string>[]}
            />
          </Card>
          <div className="flex justify-end">
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </form>
      </div>
    </>
  );
}
