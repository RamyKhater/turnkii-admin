import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import { can, type Capability } from "./rbac";
import type { User } from "@/lib/db/schema";

/** Page guard: returns the user or redirects to /login. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Page guard: user must hold the capability, else redirect to /denied. */
export async function requireCap(cap: Capability): Promise<User> {
  const user = await requireUser();
  if (!can(user.role, cap)) redirect("/denied");
  return user;
}

/** Action guard: throws instead of redirecting (surfaced to the caller). */
export async function assertCap(cap: Capability): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (!can(user.role, cap)) throw new Error("Not authorized");
  return user;
}
