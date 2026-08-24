import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentOwner } from "@/lib/owner/session";
import { can } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Accepted input formats — including iPhone HEIC/HEIF, which we convert below.
const INPUT_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/heic", "image/heif",
]);
const EXT_TYPE: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  avif: "image/avif", gif: "image/gif", heic: "image/heic", heif: "image/heif",
};
const MAX_IN = 30 * 1024 * 1024; // 30 MB (raw phone/HEIC photos can be large)
const MAX_DIM = 2200; // cap the longest side for the web

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const staffOk = user && (can(user.role, "content:edit") || can(user.role, "payments:manage"));
  const owner = staffOk ? null : await getCurrentOwner();
  if (!staffOk && !owner) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }
  const uploaderId = user?.id ?? null;

  const rl = await rateLimit(`upload:${uploaderId ?? owner?.id ?? clientIp(req.headers)}`, 30, 60_000);
  if (!rl.ok) return Response.json({ error: "Too many uploads, please slow down." }, { status: 429 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file received." }, { status: 400 });

  // Resolve the kind from the MIME type, falling back to the filename extension
  // (HEIC files often arrive with an empty or octet-stream type).
  const fnExt = (file.name.split(".").pop() || "").toLowerCase();
  const type = INPUT_TYPES.has(file.type) ? file.type : EXT_TYPE[fnExt];
  if (!type || !INPUT_TYPES.has(type)) {
    return Response.json(
      { error: "That file isn't a supported image. Use a JPG, PNG, WebP, GIF or an iPhone HEIC photo." },
      { status: 415 },
    );
  }
  if (file.size > MAX_IN) {
    return Response.json(
      { error: `That image is too large (${(file.size / 1048576).toFixed(1)}MB). The limit is 30MB.` },
      { status: 413 },
    );
  }

  const input = Buffer.from(await file.arrayBuffer());

  // Normalise for the web: honour EXIF rotation, cap dimensions, and convert
  // camera formats (HEIC/AVIF/large JPEGs) to WebP. Keep PNG (transparency) and
  // GIF (animation) in their own formats.
  let out: Buffer;
  let ext: string;
  let contentType: string;
  try {
    if (type === "image/gif") {
      out = input;
      ext = "gif";
      contentType = "image/gif";
    } else {
      const sharp = (await import("sharp")).default;
      const pipeline = sharp(input, { failOn: "none" })
        .rotate()
        .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true });
      if (type === "image/png") {
        out = await pipeline.png({ compressionLevel: 9 }).toBuffer();
        ext = "png";
        contentType = "image/png";
      } else {
        out = await pipeline.webp({ quality: 82 }).toBuffer();
        ext = "webp";
        contentType = "image/webp";
      }
    }
  } catch (e) {
    console.error("upload: image processing failed", e);
    return Response.json(
      { error: "Couldn't process that image — try exporting it as a JPG or PNG." },
      { status: 422 },
    );
  }

  const name = `${randomUUID()}.${ext}`;
  const useBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID || process.env.VERCEL);
  let url: string;
  try {
    if (useBlob) {
      const { put } = await import("@vercel/blob");
      const blob = await put(`uploads/${name}`, out, {
        access: "public",
        contentType,
        addRandomSuffix: false,
        ...(process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {}),
      });
      url = blob.url;
    } else {
      const dir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, name), out);
      url = `/uploads/${name}`;
    }
  } catch (e) {
    console.error("upload: storage failed", e);
    return Response.json({ error: "Upload storage failed. Please try again." }, { status: 500 });
  }

  await logActivity(uploaderId, "media.upload", "media", name, owner ? { owner: owner.email } : undefined);
  return Response.json({ url }, { status: 201 });
}
