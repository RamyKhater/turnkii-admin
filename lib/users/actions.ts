"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users, type Role } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { logActivity } from "@/lib/activity";
import { sendAccountWelcome } from "@/lib/email/account";

const ROLE_VALUES = ["admin", "product_manager", "ops_manager", "agent", "content_editor"] as const;

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  email: z.string().email("Enter a valid email.").transform((s) => s.toLowerCase()),
  role: z.enum(ROLE_VALUES),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export type CreateUserState = { error?: string; ok?: boolean };

export async function createUser(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const admin = await assertCap("users:manage");
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = await getDb();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing.length) return { error: "A user with that email already exists." };

  const [row] = await db.insert(users).values({
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    passwordHash: hashPassword(parsed.data.password),
  }).returning();
  await logActivity(admin.id, "user.create", "user", row.id, { role: parsed.data.role });
  // Welcome the new teammate by email (after the response; never blocks the create).
  after(async () => {
    try { await sendAccountWelcome({ name: row.name, email: row.email, role: row.role }); }
    catch (e) { console.error("[users] welcome email failed", e); }
  });
  revalidatePath("/users");
  return { ok: true };
}

export async function setRole(id: number, role: Role) {
  const admin = await assertCap("users:manage");
  if (admin.id === id) throw new Error("You can't change your own role.");
  const db = await getDb();
  await db.update(users).set({ role }).where(eq(users.id, id));
  await logActivity(admin.id, "user.role", "user", id, { role });
  revalidatePath("/users");
}

export async function setActive(id: number, active: boolean) {
  const admin = await assertCap("users:manage");
  if (admin.id === id) throw new Error("You can't deactivate yourself.");
  const db = await getDb();
  await db.update(users).set({ active }).where(eq(users.id, id));
  await logActivity(admin.id, "user.active", "user", id, { active });
  revalidatePath("/users");
}
