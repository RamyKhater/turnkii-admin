"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { contentBlocks } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";

export type PublishResult = { ok: boolean; message: string; at?: string };

/**
 * Publish the current content to the public site. Records a publish marker and,
 * when SITE_DEPLOY_HOOK_URL is set, triggers a Vercel rebuild of turnkii-site —
 * which re-fetches /api/site-content and bakes the latest content into the pages.
 */
export async function publishSite(): Promise<PublishResult> {
  const user = await assertCap("content:edit");
  const db = await getDb();
  const at = new Date().toISOString();
  const marker = { at, by: user.email };

  // Upsert the publish marker (contentBlocks.key is unique).
  const existing = await db
    .select({ id: contentBlocks.id })
    .from(contentBlocks)
    .where(eq(contentBlocks.key, "__published"))
    .limit(1);
  if (existing.length) {
    await db
      .update(contentBlocks)
      .set({ value: marker, updatedAt: new Date() })
      .where(eq(contentBlocks.key, "__published"));
  } else {
    await db
      .insert(contentBlocks)
      .values({ key: "__published", label: "Last published", value: marker });
  }

  // Trigger the site rebuild if a deploy hook is configured.
  const hook = process.env.SITE_DEPLOY_HOOK_URL;
  let message: string;
  if (hook) {
    try {
      const res = await fetch(hook, { method: "POST" });
      message = res.ok
        ? "Published — the site is rebuilding now (live in ~1–2 min)."
        : `Content saved, but the deploy hook returned ${res.status}.`;
    } catch {
      message = "Content saved, but the deploy hook couldn't be reached.";
    }
  } else {
    message = "Content saved. Add SITE_DEPLOY_HOOK_URL to auto-rebuild the site.";
  }

  await logActivity(user.id, "site.publish", "content", undefined, { at, hook: !!hook });
  revalidatePath("/content");
  return { ok: true, message, at };
}
