"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { projectShowcases } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const orNull = (v: FormDataEntryValue | null) => str(v) || null;

/** Parse a MediaRepeater JSON array, keeping rows that have an image and only the
 *  requested string keys (trimmed, empty dropped). */
type Row = { image: string } & Record<string, string>;
function parseRepeater(v: FormDataEntryValue | null, keys: string[]): Row[] {
  const raw = str(v);
  if (!raw) return [];
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((it): Row | null => {
      const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
      const image = typeof o.image === "string" ? o.image : "";
      if (!image) return null;
      const row: Row = { image };
      for (const k of keys) {
        const val = o[k];
        if (typeof val === "string" && val.trim()) row[k] = val.trim();
      }
      return row;
    })
    .filter((x): x is Row => !!x);
}

function body(formData: FormData) {
  return {
    title: str(formData.get("title")) || "Untitled project showcase",
    subtitle: orNull(formData.get("subtitle")),
    intro: orNull(formData.get("intro")),
    items: parseRepeater(formData.get("items"), ["category", "caption", "note", "spec"]),
    credits: parseRepeater(formData.get("credits"), ["service", "name"]),
    ctaLabel: orNull(formData.get("ctaLabel")),
    ctaHref: orNull(formData.get("ctaHref")),
    updatedAt: new Date(),
  };
}

export async function createProjectShowcase(formData: FormData) {
  const user = await assertCap("showcases:manage");
  const token = randomBytes(24).toString("hex"); // generated once
  const db = await getDb();
  const [row] = await db
    .insert(projectShowcases)
    .values({ ...body(formData), token, createdBy: user.id })
    .returning({ id: projectShowcases.id });
  await logActivity(user.id, "projectShowcase.create", "projectShowcase", String(row.id));
  redirect(`/project-showcases/${row.id}`);
}

export async function updateProjectShowcase(formData: FormData) {
  const user = await assertCap("showcases:manage");
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db.update(projectShowcases).set(body(formData)).where(eq(projectShowcases.id, id));
  await logActivity(user.id, "projectShowcase.update", "projectShowcase", String(id));
  revalidatePath(`/project-showcases/${id}`);
  redirect(`/project-showcases/${id}`);
}

export async function setProjectShowcaseStatus(formData: FormData) {
  const user = await assertCap("showcases:manage");
  const id = Number(formData.get("id"));
  const status = str(formData.get("status")) as "draft" | "shared" | "archived";
  if (!["draft", "shared", "archived"].includes(status)) throw new Error("Invalid status");
  const db = await getDb();
  await db.update(projectShowcases).set({ status, updatedAt: new Date() }).where(eq(projectShowcases.id, id));
  await logActivity(user.id, "projectShowcase.status", "projectShowcase", String(id), { status });
  revalidatePath(`/project-showcases/${id}`);
  revalidatePath("/project-showcases");
  redirect(`/project-showcases/${id}`);
}

/** Toggle whether this showcase appears in the public "our work" gallery on the
 *  marketing homepage. Triggers a site rebuild so the homepage reflects it. */
export async function setProjectShowcaseFeatured(formData: FormData) {
  const user = await assertCap("showcases:manage");
  const id = Number(formData.get("id"));
  const featured = str(formData.get("featured")) === "true";
  const db = await getDb();
  await db.update(projectShowcases).set({ featured, updatedAt: new Date() }).where(eq(projectShowcases.id, id));
  await logActivity(user.id, "projectShowcase.featured", "projectShowcase", String(id), { featured });
  try { const { triggerSiteRebuild } = await import("@/lib/publish/trigger"); await triggerSiteRebuild(); } catch { /* rebuild optional */ }
  revalidatePath(`/project-showcases/${id}`);
  revalidatePath("/project-showcases");
}

export async function deleteProjectShowcase(formData: FormData) {
  const user = await assertCap("showcases:manage");
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db.delete(projectShowcases).where(eq(projectShowcases.id, id));
  await logActivity(user.id, "projectShowcase.delete", "projectShowcase", String(id));
  redirect("/project-showcases");
}
