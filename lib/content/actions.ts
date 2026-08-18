"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { styles, products, inspirationShots, contentBlocks, services, handovers } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";
import { triggerSiteRebuild } from "@/lib/publish/trigger";

const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";

export async function updateStyle(formData: FormData) {
  const user = await assertCap("content:edit");
  const id = Number(formData.get("id"));
  const data = {
    name: String(formData.get("name") ?? "").trim(),
    blurb: String(formData.get("blurb") ?? "").trim(),
    fromPrice: String(formData.get("fromPrice") ?? "").trim(),
    leadTime: String(formData.get("leadTime") ?? "").trim(),
    pieceCount: String(formData.get("pieceCount") ?? "").trim(),
    heroImage: String(formData.get("heroImage") ?? "").trim() || null,
    closeups: jsonArray<{ image: string; label: string; note: string }>(formData.get("closeups")),
    published: bool(formData.get("published")),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    updatedAt: new Date(),
  };
  const db = await getDb();
  await db.update(styles).set(data).where(eq(styles.id, id));
  await logActivity(user.id, "content.style.update", "style", id);
  await triggerSiteRebuild();
  revalidatePath("/content/styles");
  redirect("/content/styles");
}

export async function createStyle(formData: FormData) {
  const user = await assertCap("content:edit");
  const name = String(formData.get("name") ?? "New style").trim() || "New style";
  const db = await getDb();
  let key = slug(name);
  const clash = await db.select({ id: styles.id }).from(styles).where(eq(styles.key, key)).limit(1);
  if (clash.length) key = `${key}-${Date.now().toString(36).slice(-4)}`;
  const [row] = await db.insert(styles).values({ key, name, published: false }).returning();
  await logActivity(user.id, "content.style.create", "style", row.id);
  revalidatePath("/content/styles");
  redirect(`/content/styles/${row.id}`);
}

// ---- Handovers ----
export async function updateHandover(formData: FormData) {
  const user = await assertCap("content:edit");
  const id = Number(formData.get("id"));
  const data = {
    location: String(formData.get("location") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim() || "Untitled handover",
    provider: String(formData.get("provider") ?? "").trim(),
    role: String(formData.get("role") ?? "").trim(),
    brandMark: String(formData.get("brandMark") ?? "").trim().slice(0, 3).toUpperCase(),
    brandHex: String(formData.get("brandHex") ?? "").trim() || "#2E4A3A",
    shots: jsonArray<string | { image?: string }>(formData.get("shots"))
      .map((x) => (typeof x === "string" ? x : x?.image ?? ""))
      .filter(Boolean),
    published: bool(formData.get("published")),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    updatedAt: new Date(),
  };
  const db = await getDb();
  await db.update(handovers).set(data).where(eq(handovers.id, id));
  await logActivity(user.id, "content.handover.update", "handover", id);
  await triggerSiteRebuild();
  revalidatePath("/content/handovers");
  redirect("/content/handovers");
}

export async function createHandover(formData: FormData) {
  const user = await assertCap("content:edit");
  const title = String(formData.get("title") ?? "New handover").trim() || "New handover";
  const db = await getDb();
  let key = slug(title);
  const clash = await db.select({ id: handovers.id }).from(handovers).where(eq(handovers.key, key)).limit(1);
  if (clash.length) key = `${key}-${Date.now().toString(36).slice(-4)}`;
  const [row] = await db.insert(handovers).values({ key, title, published: false }).returning();
  await logActivity(user.id, "content.handover.create", "handover", row.id);
  revalidatePath("/content/handovers");
  redirect(`/content/handovers/${row.id}`);
}

export async function updateProduct(formData: FormData) {
  const user = await assertCap("content:edit");
  const id = Number(formData.get("id"));
  const data = {
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    spec: String(formData.get("spec") ?? "").trim(),
    price: String(formData.get("price") ?? "").trim(),
    stock: String(formData.get("stock") ?? "").trim(),
    image: String(formData.get("image") ?? "").trim() || null,
    published: bool(formData.get("published")),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    updatedAt: new Date(),
  };
  const db = await getDb();
  await db.update(products).set(data).where(eq(products.id, id));
  await logActivity(user.id, "content.product.update", "product", id);
  await triggerSiteRebuild();
  revalidatePath("/content/marketplace");
  redirect("/content/marketplace");
}

export async function createProduct(formData: FormData) {
  const user = await assertCap("content:edit");
  const db = await getDb();
  const [row] = await db.insert(products).values({
    name: String(formData.get("name") ?? "New product").trim() || "New product",
    category: String(formData.get("category") ?? "").trim(),
    spec: String(formData.get("spec") ?? "").trim(),
    price: String(formData.get("price") ?? "On request").trim(),
    stock: String(formData.get("stock") ?? "In stock").trim(),
    published: false,
  }).returning();
  await logActivity(user.id, "content.product.create", "product", row.id);
  revalidatePath("/content/marketplace");
  redirect(`/content/marketplace/${row.id}`);
}

export async function updateInspiration(formData: FormData) {
  const user = await assertCap("content:edit");
  const id = Number(formData.get("id"));
  const data = {
    key: String(formData.get("key") ?? "").trim(),
    room: String(formData.get("room") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    spec: String(formData.get("spec") ?? "").trim(),
    published: bool(formData.get("published")),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    updatedAt: new Date(),
  };
  const db = await getDb();
  await db.update(inspirationShots).set(data).where(eq(inspirationShots.id, id));
  await logActivity(user.id, "content.inspiration.update", "inspiration", id);
  await triggerSiteRebuild();
  revalidatePath("/content/inspiration");
  redirect("/content/inspiration");
}

const TABLE = { style: styles, product: products, inspiration: inspirationShots, service: services, handover: handovers } as const;
const LISTPATH = { style: "styles", product: "marketplace", inspiration: "inspiration", service: "services", handover: "handovers" } as const;

/** Parse a JSON array submitted from a client repeater field; [] on any error. */
function jsonArray<T>(v: FormDataEntryValue | null): T[] {
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
type Entity = keyof typeof TABLE;

/** Toggle published from a list row (entity + id). */
export async function togglePublish(entity: Entity, id: number, next: boolean) {
  const user = await assertCap("content:edit");
  const db = await getDb();
  await db.update(TABLE[entity]).set({ published: next, updatedAt: new Date() }).where(eq(TABLE[entity].id, id));
  await logActivity(user.id, `content.${entity}.publish`, entity, id, { published: next });
  await triggerSiteRebuild();
  revalidatePath(`/content/${LISTPATH[entity]}`);
}

export async function deleteItem(entity: Entity, id: number) {
  const user = await assertCap("content:edit");
  const db = await getDb();
  await db.delete(TABLE[entity]).where(eq(TABLE[entity].id, id));
  await logActivity(user.id, `content.${entity}.delete`, entity, id);
  await triggerSiteRebuild();
  revalidatePath(`/content/${LISTPATH[entity]}`);
}

// ---- Services ----
export async function updateService(formData: FormData) {
  const user = await assertCap("content:edit");
  const id = Number(formData.get("id"));
  const data = {
    name: String(formData.get("name") ?? "").trim(),
    short: String(formData.get("short") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    lead: String(formData.get("lead") ?? "").trim(),
    priceFrom: String(formData.get("priceFrom") ?? "").trim(),
    image: String(formData.get("image") ?? "").trim(),
    published: bool(formData.get("published")),
    enabled: bool(formData.get("enabled")),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    updatedAt: new Date(),
  };
  const db = await getDb();
  await db.update(services).set(data).where(eq(services.id, id));
  await logActivity(user.id, "content.service.update", "service", id);
  await triggerSiteRebuild();
  revalidatePath("/content/services");
  redirect("/content/services");
}

export async function createService(formData: FormData) {
  const user = await assertCap("content:edit");
  const name = String(formData.get("name") ?? "New service").trim() || "New service";
  const db = await getDb();
  let key = slug(name);
  // ensure unique key
  const clash = await db.select({ id: services.id }).from(services).where(eq(services.key, key)).limit(1);
  if (clash.length) key = `${key}-${Date.now().toString(36).slice(-4)}`;
  const [row] = await db.insert(services).values({ key, name, published: false }).returning();
  await logActivity(user.id, "content.service.create", "service", row.id);
  revalidatePath("/content/services");
  redirect(`/content/services/${row.id}`);
}

const heroSchema = z.object({
  kicker: z.string().trim(),
  headline: z.string().trim().min(1),
  sub: z.string().trim(),
});

export async function saveCopy(formData: FormData) {
  const user = await assertCap("content:edit");
  const db = await getDb();

  const parsed = heroSchema.parse({
    kicker: formData.get("kicker"),
    headline: formData.get("headline"),
    sub: formData.get("sub"),
  });
  const hero = { ...parsed, image: String(formData.get("heroImage") ?? "").trim() || null };
  const stats = [0, 1, 2, 3].map((i) => ({
    n: String(formData.get(`stat_n_${i}`) ?? "").trim(),
    label: String(formData.get(`stat_label_${i}`) ?? "").trim(),
  })).filter((s) => s.n || s.label);

  // Upsert so it works whether or not the rows exist yet.
  await db
    .insert(contentBlocks)
    .values([
      { key: "hero", label: "Landing hero", value: hero },
      { key: "stats", label: "Landing stats", value: stats },
    ])
    .onConflictDoUpdate({
      target: contentBlocks.key,
      set: { value: sql`excluded.value`, updatedAt: new Date() },
    });

  await logActivity(user.id, "content.copy.update", "content", "hero+stats");
  await triggerSiteRebuild();
  revalidatePath("/content/copy");
  redirect("/content/copy");
}
