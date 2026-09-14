import { requireCap } from "@/lib/auth/guard";
import { PageHeader } from "@/components/ui";
import { ProposalForm } from "@/components/proposals/proposal-form";

export default async function NewProposalPage() {
  await requireCap("proposals:manage");
  return (
    <>
      <PageHeader
        eyebrow="Proposals"
        title="New proposal"
        sub="Fill in the direction — you'll get a private share link once it's created."
      />
      <ProposalForm />
    </>
  );
}
