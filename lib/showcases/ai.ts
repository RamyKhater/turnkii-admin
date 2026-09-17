"use server";
import { assertCap } from "@/lib/auth/guard";
import { ai, AI_MODEL, aiEnabled, parseJson, textOf } from "@/lib/ai/client";

export type ShowcaseDraft = { category?: string; caption?: string; note?: string; spec?: string };

/** Vision draft for a sample-work photo: a category, an evocative caption, a
 *  one-line craftsmanship note and a materials/finish spec. Only public http(s)
 *  image URLs can be analysed; returns {} when AI is unconfigured or on error. */
export async function aiDraftShowcaseImage(imageUrl: string): Promise<ShowcaseDraft> {
  await assertCap("showcases:manage");
  if (!aiEnabled() || !/^https?:\/\//i.test(imageUrl)) return {};
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
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: "Draft the showcase description for this finishing/furniture photo." },
        ],
      }],
    });
    const p = parseJson<ShowcaseDraft>(textOf(msg));
    if (!p) return {};
    const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    return {
      category: s(p.category, 40),
      caption: s(p.caption, 80),
      note: s(p.note, 200),
      spec: s(p.spec, 120),
    };
  } catch {
    return {};
  }
}
