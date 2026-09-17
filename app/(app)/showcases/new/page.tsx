import { requireCap } from "@/lib/auth/guard";
import { PageHeader } from "@/components/ui";
import { ShowcaseForm } from "@/components/showcases/showcase-form";

export default async function NewShowcasePage() {
  await requireCap("showcases:manage");
  return (
    <>
      <PageHeader eyebrow="Sample work" title="New showcase" sub="Add your work — you'll get a private share link once it's created." />
      <ShowcaseForm />
    </>
  );
}
