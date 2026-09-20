"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requests, requestNotes, scopeOfWork, type SowComment } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { ROLE_LABEL } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";

// The reviewer roles here (admin / ops_manager) act as the Turnkii admin,
// operations and design reviewers in the SoW review loop.
function reviewRole(role: string): SowComment["role"] {
  return role === "admin" ? "admin" : "ops";
}

/** Operations shares a request's survey outcome + notes with flpp so it can
 *  AI-draft the Scope of Work. Enabled once the survey is done (files or a
 *  survey note exist). Idempotent — re-sharing just refreshes the timestamp. */
export async function shareSurveyWithFlpp(requestId: number) {
  const user = await assertCap("projects:manage");
  const db = await getDb();
  await db.update(requests).set({ flppSharedAt: new Date(), updatedAt: new Date() }).where(eq(requests.id, requestId));
  await db.insert(requestNotes).values({
    requestId,
    authorId: user.id,
    kind: "status",
    body: "Survey outcome + notes shared with flpp to draft the Scope of Work.",
  });
  await logActivity(user.id, "flpp.share_survey", "request", requestId);
  revalidatePath(`/requests/${requestId}`);
}

/** Accept the SoW flpp shared for review → publish to the customer. The token
 *  is already minted by flpp and carries the customer URL; accepting flips the
 *  status to `shared` so the public /sow page serves it. */
export async function acceptSow(requestId: number, token: string) {
  const user = await assertCap("projects:manage");
  const db = await getDb();
  const [sow] = await db.select().from(scopeOfWork).where(eq(scopeOfWork.token, token)).limit(1);
  if (!sow) throw new Error("Scope of Work not found.");
  await db.update(scopeOfWork).set({ status: "shared", updatedAt: new Date() }).where(eq(scopeOfWork.token, token));
  await logActivity(user.id, "flpp.sow_accept", "scope_of_work", sow.id, { requestId, docRef: sow.docRef });
  revalidatePath(`/requests/${requestId}`);
  return { ok: true, customerUrl: sow.customerUrl };
}

const editSchema = z.object({
  requestId: z.coerce.number().int(),
  token: z.string().min(8),
  author: z.enum(["customer", "ops", "design", "admin"]),
  body: z.string().trim().min(1, "Add a comment describing the edit.").max(2000),
});

export type SowReviewState = { error?: string; ok?: boolean };

/** Request an edit from flpp → append a review comment and flip the status to
 *  `changes_requested`. flpp pulls the comment back, revises and re-shares. The
 *  comment can be a customer comment or an ops / design / admin note. */
export async function requestSowEdit(_prev: SowReviewState, form: FormData): Promise<SowReviewState> {
  const user = await assertCap("projects:manage");
  const parsed = editSchema.safeParse({
    requestId: form.get("requestId"),
    token: form.get("token"),
    author: form.get("author"),
    body: form.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const db = await getDb();
  const [sow] = await db.select().from(scopeOfWork).where(eq(scopeOfWork.token, parsed.data.token)).limit(1);
  if (!sow) return { error: "Scope of Work not found." };

  const prior = sow.comments ?? [];
  const round = prior.length ? Math.max(...prior.map((c) => c.round)) + 1 : 1;
  const authorName = parsed.data.author === "customer" ? "Customer" : `${user.name} (${ROLE_LABEL[user.role] ?? user.role})`;
  const comment: SowComment = {
    round,
    author: authorName,
    role: parsed.data.author === "ops" ? reviewRole(user.role) : parsed.data.author,
    body: parsed.data.body,
    at: new Date().toISOString(),
  };
  await db.update(scopeOfWork).set({
    comments: [...prior, comment],
    status: "changes_requested",
    updatedAt: new Date(),
  }).where(eq(scopeOfWork.token, parsed.data.token));
  await logActivity(user.id, "flpp.sow_request_edit", "scope_of_work", sow.id, { requestId: parsed.data.requestId, round });
  revalidatePath(`/requests/${parsed.data.requestId}`);
  return { ok: true };
}
