import { requireCap } from "@/lib/auth/guard";
import { PageHeader } from "@/components/ui";
import { ProjectShowcaseForm } from "@/components/project-showcases/project-showcase-form";

export default async function NewProjectShowcasePage() {
  await requireCap("showcases:manage");
  return (
    <>
      <PageHeader eyebrow="Project showcase" title="New project showcase" sub="Build it service by service — you'll get a private share link once it's created." />
      <ProjectShowcaseForm />
    </>
  );
}
