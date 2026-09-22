"use server";
import { assertCap } from "@/lib/auth/guard";
import { ai, AI_MODEL, aiEnabled, parseJson, textOf } from "@/lib/ai/client";

// `error` carries a human-readable reason back to the form so a failed draft is
// diagnosable (e.g. AI not configured) instead of a silent "couldn't draft".
export type ShowcaseDraft = { category?: string; caption?: string; note?: string; spec?: string; error?: string };

const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type MediaType = (typeof ALLOWED_MEDIA)[number];

/** Fetch the (public) image and return it as a base64 data payload for the vision
 *  API — more robust than passing a URL (works even if the store blocks the
 *  model's fetch), and lets us report a clear error if the image can't be read. */
async function fetchImage(url: string): Promise<{ media: MediaType; data: string } | { error: string }> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return { error: `Couldn't read the image (HTTP ${resp.status}).` };
    const ct = (resp.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const media = (ALLOWED_MEDIA as readonly string[]).includes(ct) ? (ct as MediaType) : "image/webp";
    const data = Buffer.from(await resp.arrayBuffer()).toString("base64");
    if (!data) return { error: "The image appears to be empty." };
    return { media, data };
  } catch {
    return { error: "Couldn't reach the image to analyse it." };
  }
}

/** Vision draft for a sample-work photo: a category, an evocative caption, a
 *  one-line craftsmanship note and a materials/finish spec. Only public http(s)
 *  image URLs can be analysed; returns {error} when AI is unconfigured or on error. */
export async function aiDraftShowcaseImage(imageUrl: string): Promise<ShowcaseDraft> {
  await assertCap("showcases:manage");
  if (!aiEnabled()) return { error: "AI isn't configured — set ANTHROPIC_API_KEY in the admin environment." };
  if (!/^https?:\/\//i.test(imageUrl)) return { error: "Upload the image first, then draft." };
  const img = await fetchImage(imageUrl);
  if ("error" in img) return { error: img.error };
  try {
    const msg = await ai().messages.create({
      model: AI_MODEL,
      max_tokens: 500,
      system:
        "You are an interior finishing & furniture specialist writing a bespoke 'sample work' showcase for a prospective home-finishing/renovation client (Turnkii). " +
        "Look closely at the photo of completed work and describe the QUALITY OF EXECUTION a client would care about — craftsmanship, materials, finish, detailing. " +
        "Produce four fields:\n" +
        "- category: one or two words, the room or work type (e.g. Finishing, Furniture, Kitchen, Bathroom, Joinery, Outdoor). Prefer 'Finishing' or 'Furniture' when it fits.\n" +
        "- caption: a short, specific title (max 8 words), no full stop, e.g. 'Book-matched veneer feature wall'.\n" +
        "- note: ONE sentence (max 22 words) highlighting the craftsmanship / execution detail visible in the shot.\n" +
        "- spec: the likely materials and finishes, comma-separated (max 8 words), e.g. 'American walnut veneer, matte PU lacquer'.\n" +
        "British English. Confident but factual — never invent brand names or measurements you can't see. " +
        'Reply with ONLY JSON: {"category": "...", "caption": "...", "note": "...", "spec": "..."}.',
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: img.media, data: img.data } },
          { type: "text", text: "Draft the showcase description for this finishing/furniture photo." },
        ],
      }],
    });
    const p = parseJson<ShowcaseDraft>(textOf(msg));
    if (!p) return { error: "The AI reply couldn't be read — try again." };
    const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    return {
      category: s(p.category, 40),
      caption: s(p.caption, 80),
      note: s(p.note, 200),
      spec: s(p.spec, 120),
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown error";
    return { error: `AI request failed: ${detail.slice(0, 160)}` };
  }
}
