import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { properties, styles } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { ProjectForm } from "@/components/projects/project-form";
import { createProject } from "@/lib/projects/actions";

export default async function NewProjectPage() {
  await requireCap("payments:manage");
  const db = await getDb();
  const props = await db.select({ id: properties.id, name: properties.name }).from(properties).orderBy(asc(properties.name));
  const styleRows = await db.select({ key: styles.key, name: styles.name }).from(styles).orderBy(asc(styles.sortOrder));

  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="New project"
        sub="Attach it to a property so payments and updates roll up to the owner."
        actions={<Link href="/projects" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Projects</Link>}
      />
      <div className="max-w-2xl p-6 lg:p-8">
        <Card className="p-6">
          <ProjectForm action={createProject} properties={props} styles={styleRows} />
        </Card>
      </div>
    </>
  );
}
