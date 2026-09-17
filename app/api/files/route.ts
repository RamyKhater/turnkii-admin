import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Documents + images captured during a survey. Stored as-is (no processing), so
// PDFs, spreadsheets, CAD exports and photos all keep their original bytes.
const DOC_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  dwg: "application/acad",
  dxf: "application/dxf",
  zip: "application/zip",
};
const IMG_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", heic: "image/heic", heif: "image/heif", avif: "image/avif",
};
const MAX = 40 * 1024 * 1024; // 40 MB

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !(can(user.role, "requests:update") || can(user.role, "projects:manage") || can(user.role, "content:edit"))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }
  const rl = await rateLimit(`file:${user.id}`, 40, 60_000);
  if (!rl.ok) return Response.json({ error: "Too many uploads, please slow down." }, { status: 429 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file received." }, { status: 400 });

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const isImage = ext in IMG_TYPES || file.type.startsWith("image/");
  const contentType = file.type || IMG_TYPES[ext] || DOC_TYPES[ext] || "application/octet-stream";
  if (!isImage && !(ext in DOC_TYPES)) {
    return Response.json({ error: "Unsupported file type. Use a PDF, Office doc, image, CSV, DWG/DXF or ZIP." }, { status: 415 });
  }
  if (file.size > MAX) {
    return Response.json({ error: `That file is too large (${(file.size / 1048576).toFixed(1)}MB). The limit is 40MB.` }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const safeExt = (ext || "bin").replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const key = `${randomUUID()}.${safeExt}`;
  const useBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID || process.env.VERCEL);
  let url: string;
  try {
    if (useBlob) {
      const { put } = await import("@vercel/blob");
      const blob = await put(`survey/${key}`, buf, {
        access: "public",
        contentType,
        addRandomSuffix: false,
        ...(process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {}),
      });
      url = blob.url;
    } else {
      const dir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, key), buf);
      url = `/uploads/${key}`;
    }
  } catch (e) {
    console.error("file upload: storage failed", e);
    return Response.json({ error: "Upload storage failed. Please try again." }, { status: 500 });
  }

  await logActivity(user.id, "file.upload", "file", key, { name: file.name });
  return Response.json(
    { url, name: file.name.slice(0, 200), type: contentType, size: file.size, kind: isImage ? "image" : "document" },
    { status: 201 },
  );
}
