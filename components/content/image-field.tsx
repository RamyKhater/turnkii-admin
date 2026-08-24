"use client";
import { useRef, useState } from "react";
import { uploadImage } from "./downscale";

export function ImageField({
  name,
  label = "Image",
  defaultValue,
}: {
  name: string;
  label?: string;
  defaultValue?: string | null;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      setUrl(await uploadImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-start gap-4">
        <div className="grid h-24 w-32 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-sand text-xs text-muted">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            "No image"
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="self-start rounded-full border border-line bg-paper px-4 py-2 text-sm font-semibold hover:border-ink disabled:opacity-60"
          >
            {busy ? "Uploading…" : url ? "Replace image" : "Upload image"}
          </button>
          {url && (
            <button type="button" onClick={() => setUrl("")} className="self-start text-xs font-semibold text-crit hover:underline">
              Remove
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          {error && <span className="text-xs font-medium text-crit">{error}</span>}
          <span className="text-xs text-muted">JPG, PNG, WebP, AVIF or HEIC — large photos are resized automatically.</span>
        </div>
      </div>
    </div>
  );
}
