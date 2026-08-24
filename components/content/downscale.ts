// Resize/compress an image in the browser BEFORE upload so it always fits under
// the serverless request-body limit (~4.5MB on Vercel). Camera photos are often
// 5–15MB; this brings them to a few hundred KB while keeping them sharp.
//
// Returns the original file when it can't be decoded in this browser (e.g. HEIC
// in Chrome) — the server then handles/optimises it.
export async function downscaleImage(file: File, maxDim = 2200, quality = 0.85): Promise<File> {
  const looksImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(file.name);
  if (!looksImage) return file;
  if (file.type === "image/gif") return file; // preserve animation

  // iPhone HEIC/HEIF: browsers other than Safari can't decode it, so convert to
  // JPEG in the browser first (libheif WASM), then downscale below.
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
    try {
      const heic2any = (await import("heic2any")).default as (o: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>;
      const res = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      const blob = Array.isArray(res) ? res[0] : res;
      file = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch {
      /* fall through — Safari can decode HEIC directly via createImageBitmap */
    }
  }

  let bitmap: ImageBitmap;
  try {
    // from-image honours EXIF orientation so phone photos aren't sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // undecodable — let the server try
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

// Fetch /api/upload with a pre-resized file, tolerating non-JSON error bodies
// (Vercel's platform 413 is plain text, which would otherwise crash res.json()).
export async function uploadImage(file: File): Promise<string> {
  const toSend = await downscaleImage(file);
  const fd = new FormData();
  fd.append("file", toSend);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const text = await res.text();
  let json: { url?: string; error?: string } = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body (platform error) */
  }
  if (!res.ok || !json.url) {
    if (res.status === 413) throw new Error("That image is too large even after resizing — try a smaller photo.");
    throw new Error(json.error || `Upload failed (${res.status}). Please try again.`);
  }
  return json.url;
}
