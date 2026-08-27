import "server-only";
import { ai, AI_MODEL, aiEnabled, parseJson, textOf } from "./client";

export type PhotoQA = { ok: boolean; severity: "none" | "minor" | "major"; caption: string; issues: string[] };

/** Vision QA on a progress photo: caption + snag/defect flags against the milestone.
 *  Only http(s) URLs can be analysed; anything else returns a neutral result. */
export async function photoQA(imageUrl: string, ctx: { milestone?: string | null; stage?: string | null }): Promise<PhotoQA> {
  const empty: PhotoQA = { ok: true, severity: "none", caption: "", issues: [] };
  if (!aiEnabled() || !/^https?:\/\//i.test(imageUrl)) return empty;
  try {
    const msg = await ai().messages.create({
      model: AI_MODEL,
      max_tokens: 700,
      system:
        "You are a senior site QA inspector for a home fit-out contractor (Turnkii). " +
        "Given a progress photo about to be sent to the client for approval, judge whether the work looks complete and defect-free for its milestone. " +
        "Flag only real, visible problems: incomplete work, visible defects, poor finish, wrong/missing items, damage, mess left in shot. " +
        'Reply with ONLY JSON: {"caption": short factual caption (max 12 words), "severity": "none"|"minor"|"major", "issues": [short strings], "ok": boolean}. ' +
        "ok is true when it is safe to send to the client (severity none or minor cosmetic).",
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: `Milestone: ${ctx.milestone || ctx.stage || "general progress"}. Assess this photo.` },
        ],
      }],
    });
    const parsed = parseJson<PhotoQA>(textOf(msg));
    if (!parsed) return empty;
    return {
      ok: parsed.ok !== false && parsed.severity !== "major",
      severity: (["none", "minor", "major"].includes(parsed.severity) ? parsed.severity : "none") as PhotoQA["severity"],
      caption: String(parsed.caption || "").slice(0, 120),
      issues: Array.isArray(parsed.issues) ? parsed.issues.map((s) => String(s)).slice(0, 6) : [],
    };
  } catch {
    return empty;
  }
}

/** Draft the client-facing update note from the attached media + milestone. */
export async function draftUpdateNote(input: { stage?: string; milestone?: string; items: { caption?: string | null; type?: string }[] }): Promise<string> {
  if (!aiEnabled()) return "";
  const shots = input.items.map((i) => `- ${i.type === "video" ? "Video: " : ""}${i.caption || "media"}`).join("\n") || "- (no captions yet)";
  try {
    const msg = await ai().messages.create({
      model: AI_MODEL,
      max_tokens: 400,
      system:
        "You write short, warm, factual progress notes to a home-finishing client, on behalf of the Turnkii site team. " +
        "2–3 sentences. Say what was done and what happens next. British English, no emojis, no marketing fluff, no greeting or sign-off.",
      messages: [{ role: "user", content: `Stage: ${input.stage || "this week"}\nMilestone: ${input.milestone || "—"}\nMedia shared:\n${shots}\n\nWrite the note.` }],
    });
    return textOf(msg);
  } catch {
    return "";
  }
}

/** Turn a client's reject/reshoot feedback into a concrete crew action list. */
export async function rejectionToTasks(input: { caption?: string | null; status: string; reason?: string | null; comment?: string | null }): Promise<string[]> {
  if (!aiEnabled()) return [];
  try {
    const msg = await ai().messages.create({
      model: AI_MODEL,
      max_tokens: 400,
      system:
        "You are a site foreman. A client rejected or asked to re-shoot a progress item. " +
        "Turn their feedback into 1–4 concrete, actionable tasks for the crew (imperative, specific, no fluff). " +
        'Reply with ONLY a JSON array of short strings.',
      messages: [{ role: "user", content: `Item: ${input.caption || "—"}\nDecision: ${input.status}\nReason: ${input.reason || "—"}\nClient comment: ${input.comment || "—"}` }],
    });
    const tasks = parseJson<string[]>(textOf(msg));
    return Array.isArray(tasks) ? tasks.map((t) => String(t)).slice(0, 4) : [];
  } catch {
    return [];
  }
}
