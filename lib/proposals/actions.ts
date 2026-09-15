"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { proposals, requests } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const orNull = (v: FormDataEntryValue | null) => str(v) || null;

/** Parse a textarea of "a | b | c" lines into typed rows, dropping empty lines. */
function lines(v: FormDataEntryValue | null): string[][] {
  return str(v)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split("|").map((p) => p.trim()));
}

// The image uploader (MediaRepeater) serialises to a JSON array of { image, title };
// fall back to newline-separated URLs so older/pasted input still works. Stored as
// { url, title? } objects.
function parseImages(v: FormDataEntryValue | null): { url: string; title?: string }[] {
  const raw = str(v);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr
        .map((it) => {
          const url = typeof it === "string" ? it : it?.image ?? it?.url;
          if (!url || typeof url !== "string") return null;
          const title = typeof it?.title === "string" ? it.title.trim() : "";
          return title ? { url, title } : { url };
        })
        .filter((x): x is { url: string; title?: string } => !!x);
    }
  } catch { /* not JSON — treat as newline URLs */ }
  return raw.split("\n").map((l) => l.trim()).filter(Boolean).map((url) => ({ url }));
}

function parseBody(formData: FormData) {
  const images = parseImages(formData.get("images"));
  const scopeItems = lines(formData.get("scopeItems")).map(([label, note, price]) => ({
    label: label ?? "",
    ...(note ? { note } : {}),
    ...(price ? { price } : {}),
  }));
  const timelineItems = lines(formData.get("timelineItems")).map(([phase, duration, note]) => ({
    phase: phase ?? "",
    ...(duration ? { duration } : {}),
    ...(note ? { note } : {}),
  }));
  const rid = str(formData.get("requestId"));
  return {
    title: str(formData.get("title")) || "Untitled proposal",
    clientName: orNull(formData.get("clientName")),
    requestId: rid ? Number(rid) : null,
    intro: orNull(formData.get("intro")),
    styleName: orNull(formData.get("styleName")),
    palette: orNull(formData.get("palette")),
    directionNote: orNull(formData.get("directionNote")),
    images,
    scopeItems,
    priceLabel: orNull(formData.get("priceLabel")),
    financingNote: orNull(formData.get("financingNote")),
    timelineItems,
    timelineNote: orNull(formData.get("timelineNote")),
    ctaType: orNull(formData.get("ctaType")),
    ctaLabel: orNull(formData.get("ctaLabel")),
    ctaValue: orNull(formData.get("ctaValue")),
    updatedAt: new Date(),
  };
}

export async function createProposal(formData: FormData) {
  const user = await assertCap("proposals:manage");
  // The share token is generated once, here, and never regenerated.
  const token = randomBytes(24).toString("hex");
  const db = await getDb();
  const body = parseBody(formData);
  // When linked to a request and no client name was typed, borrow the lead's name.
  if (!body.clientName && body.requestId) {
    const [req] = await db
      .select({ name: requests.contactName })
      .from(requests)
      .where(eq(requests.id, body.requestId))
      .limit(1);
    if (req?.name) body.clientName = req.name;
  }
  const [row] = await db
    .insert(proposals)
    .values({ ...body, token, createdBy: user.id })
    .returning({ id: proposals.id });
  await logActivity(user.id, "proposal.create", "proposal", String(row.id));
  redirect(`/proposals/${row.id}`);
}

export async function updateProposal(formData: FormData) {
  const user = await assertCap("proposals:manage");
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db.update(proposals).set(parseBody(formData)).where(eq(proposals.id, id));
  await logActivity(user.id, "proposal.update", "proposal", String(id));
  revalidatePath(`/proposals/${id}`);
  redirect(`/proposals/${id}`);
}

/** Move a proposal between lifecycle states (draft ↔ sent ↔ archived). */
export async function setProposalStatus(formData: FormData) {
  const user = await assertCap("proposals:manage");
  const id = Number(formData.get("id"));
  const status = str(formData.get("status")) as "draft" | "sent" | "archived";
  if (!["draft", "sent", "archived"].includes(status)) throw new Error("Invalid status");
  const db = await getDb();
  await db.update(proposals).set({ status, updatedAt: new Date() }).where(eq(proposals.id, id));
  await logActivity(user.id, "proposal.status", "proposal", String(id), { status });
  revalidatePath(`/proposals/${id}`);
  revalidatePath("/proposals");
  redirect(`/proposals/${id}`);
}

export async function deleteProposal(formData: FormData) {
  const user = await assertCap("proposals:manage");
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db.delete(proposals).where(eq(proposals.id, id));
  await logActivity(user.id, "proposal.delete", "proposal", String(id));
  redirect("/proposals");
}
