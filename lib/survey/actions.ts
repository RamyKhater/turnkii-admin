"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { surveyFiles, requests } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const int = (v: FormDataEntryValue | null) => {
  const n = Number(str(v));
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Agents may only touch survey files on requests assigned to them. */
async function ownedRequest(requestId: number, userId: number, role: string) {
  const db = await getDb();
  const [req] = await db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  if (!req) throw new Error("Request not found");
  if (role === "agent" && req.assignedTo !== userId) throw new Error("This request isn't assigned to you.");
  return req;
}

export async function addSurveyFile(formData: FormData) {
  const user = await assertCap("requests:update");
  const requestId = int(formData.get("requestId"));
  const url = str(formData.get("url"));
  if (!requestId || !url) return;
  await ownedRequest(requestId, user.id, user.role);
  const db = await getDb();
  await db.insert(surveyFiles).values({
    requestId,
    kind: str(formData.get("kind")) === "image" ? "image" : "document",
    url,
    name: str(formData.get("name")).slice(0, 200) || "file",
    contentType: str(formData.get("contentType")) || null,
    size: int(formData.get("size")),
    note: str(formData.get("note")).slice(0, 500) || null,
    uploadedBy: user.id,
  });
  await logActivity(user.id, "survey.file.add", "request", String(requestId));
  revalidatePath(`/requests/${requestId}`);
}

export async function updateSurveyNote(formData: FormData) {
  const user = await assertCap("requests:update");
  const id = int(formData.get("id"));
  const requestId = int(formData.get("requestId"));
  if (!id || !requestId) return;
  await ownedRequest(requestId, user.id, user.role);
  const db = await getDb();
  await db.update(surveyFiles).set({ note: str(formData.get("note")).slice(0, 500) || null }).where(eq(surveyFiles.id, id));
  revalidatePath(`/requests/${requestId}`);
}

export async function deleteSurveyFile(formData: FormData) {
  const user = await assertCap("requests:update");
  const id = int(formData.get("id"));
  const requestId = int(formData.get("requestId"));
  if (!id || !requestId) return;
  await ownedRequest(requestId, user.id, user.role);
  const db = await getDb();
  await db.delete(surveyFiles).where(eq(surveyFiles.id, id));
  await logActivity(user.id, "survey.file.delete", "request", String(requestId));
  revalidatePath(`/requests/${requestId}`);
}

/** Link (or unlink) all of a request's survey files to a project once it starts. */
export async function linkSurveyToProject(formData: FormData) {
  const user = await assertCap("projects:manage");
  const requestId = int(formData.get("requestId"));
  const projectId = int(formData.get("projectId")); // null clears the link
  if (!requestId) return;
  const db = await getDb();
  await db.update(surveyFiles).set({ projectId }).where(eq(surveyFiles.requestId, requestId));
  await logActivity(user.id, "survey.link", "request", String(requestId), { projectId });
  revalidatePath(`/requests/${requestId}`);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}
