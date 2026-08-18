"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "./password";
import { createSession, destroySession, getCurrentUser } from "./session";
import { homeSectionFor } from "./rbac";
import { logActivity } from "@/lib/activity";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const ip = clientIp(await headers());
  const rl = await rateLimit(`login:${ip}`, 10, 60_000);
  if (!rl.ok) return { error: "Too many attempts. Please wait a minute and try again." };

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase().trim()))
    .limit(1);

  if (!user || !user.active || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return { error: "Those credentials don't match an active account." };
  }

  await createSession(user.id);
  await logActivity(user.id, "login", "user", user.id);
  redirect(homeSectionFor(user.role));
}

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await logActivity(user.id, "logout", "user", user.id);
  await destroySession();
  redirect("/login");
}
