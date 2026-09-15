import { desc, eq } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { requests } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui";
import { ProposalForm } from "@/components/proposals/proposal-form";

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string }>;
}) {
  const user = await requireCap("proposals:manage");
  const { requestId } = await searchParams;
  const preRequestId = requestId && Number.isInteger(Number(requestId)) ? Number(requestId) : undefined;
  const db = await getDb();
  // Agents can only link to their own requests; managers/admins see all.
  const scope = can(user.role, "requests:view_all") ? undefined : eq(requests.assignedTo, user.id);
  const reqRows = await db
    .select({ id: requests.id, ref: requests.ref, contactName: requests.contactName })
    .from(requests)
    .where(scope)
    .orderBy(desc(requests.createdAt))
    .limit(200);
  return (
    <>
      <PageHeader
        eyebrow="Proposals"
        title="New proposal"
        sub="Fill in the direction — you'll get a private share link once it's created."
      />
      <ProposalForm requests={reqRows} defaultRequestId={preRequestId} />
    </>
  );
}
