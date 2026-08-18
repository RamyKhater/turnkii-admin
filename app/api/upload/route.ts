import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentOwner } from "@/lib/owner/session";
import { can } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif",
};
const MAX = 8 * 1024 * 1024; // 8 MB

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const staffOk = user && (can(user.role, "content:edit") || can(user.role, "payments:manage"));
  const owner = staffOk ? null : await getCurrentOwner();
  if (!staffOk && !owner) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }
  const uploaderId = user?.id ?? null;

  const rl = await rateLimit(`upload:${uploaderId ?? owner?.id ?? clientIp(req.headers)}`, 30, 60_000);
  if (!rl.ok) return Response.json({ error: "Too many uploads, slow down." }, { status: 429 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  const ext = ALLOWED[file.type];
  if (!ext) return Response.json({ error: "Unsupported image type" }, { status: 415 });
  if (file.size > MAX) return Response.json({ error: "Image too large (max 8MB)" }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const name = `${randomUUID()}.${ext}`;

  // Use Vercel Blob whenever a store is connected (OIDC on Vercel) or an
  // explicit RW token is present; fall back to local disk only in dev.
  const useBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID || process.env.VERCEL);
  let url: string;
  if (useBlob) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${name}`, bytes, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
      ...(process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {}),
    });
    url = blob.url;
  } else {
    // Local dev fallback: write into public/uploads.
    const dir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), bytes);
    url = `/uploads/${name}`;
  }

  await logActivity(uploaderId, "media.upload", "media", name, owner ? { owner: owner.email } : undefined);
  return Response.json({ url }, { status: 201 });
}
