import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { homeSectionFor } from "@/lib/auth/rbac";

export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? homeSectionFor(user.role) : "/login");
}
