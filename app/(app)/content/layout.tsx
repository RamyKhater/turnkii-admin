import { requireCap } from "@/lib/auth/guard";

export default async function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCap("content:edit");
  return <>{children}</>;
}
