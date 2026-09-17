"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { showcases } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const orNull = (v: FormDataEntryValue | null) => str(v) || null;

type Item = { image: string; before?: string; category?: string; caption?: string; note?: string; spec?: string };

/** Parse the MediaRepeater JSON into showcase items, keeping only non-empty
 *  fields and dropping rows without an image. */
function parseItems(v: FormDataEntryValue | null): Item[] {
  const raw = str(v);
  if (!raw) return [];
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((it): Item | null => {
      const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
      const image = typeof o.image === "string" ? o.image : "";
      if (!image) return null;
      const pick = (k: string) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string).trim() : undefined);
      return { image, before: pick("before"), category: pick("category"), caption: pick("caption"), note: pick("note"), spec: pick("spec") };
    })
    .filter((x): x is Item => !!x);
}

function body(formData: FormData) {
  return {
    title: str(formData.get("title")) || "Untitled showcase",
    subtitle: orNull(formData.get("subtitle")),
    intro: orNull(formData.get("intro")),
    items: parseItems(formData.get("items")),
    ctaLabel: orNull(formData.get("ctaLabel")),
    ctaHref: orNull(formData.get("ctaHref")),
    updatedAt: new Date(),
  };
}

export async function createShowcase(formData: FormData) {
  const user = await assertCap("showcases:manage");
  const token = randomBytes(24).toString("hex"); // generated once
  const db = await getDb();
  const [row] = await db
    .insert(showcases)
    .values({ ...body(formData), token, createdBy: user.id })
    .returning({ id: showcases.id });
  await logActivity(user.id, "showcase.create", "showcase", String(row.id));
  redirect(`/showcases/${row.id}`);
}

export async function updateShowcase(formData: FormData) {
  const user = await assertCap("showcases:manage");
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db.update(showcases).set(body(formData)).where(eq(showcases.id, id));
  await logActivity(user.id, "showcase.update", "showcase", String(id));
  revalidatePath(`/showcases/${id}`);
  redirect(`/showcases/${id}`);
}

export async function setShowcaseStatus(formData: FormData) {
  const user = await assertCap("showcases:manage");
  const id = Number(formData.get("id"));
  const status = str(formData.get("status")) as "draft" | "shared" | "archived";
  if (!["draft", "shared", "archived"].includes(status)) throw new Error("Invalid status");
  const db = await getDb();
  await db.update(showcases).set({ status, updatedAt: new Date() }).where(eq(showcases.id, id));
  await logActivity(user.id, "showcase.status", "showcase", String(id), { status });
  revalidatePath(`/showcases/${id}`);
  revalidatePath("/showcases");
  redirect(`/showcases/${id}`);
}

export async function deleteShowcase(formData: FormData) {
  const user = await assertCap("showcases:manage");
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db.delete(showcases).where(eq(showcases.id, id));
  await logActivity(user.id, "showcase.delete", "showcase", String(id));
  redirect("/showcases");
}
