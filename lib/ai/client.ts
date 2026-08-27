import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Default to Claude Opus 5; a deployment can pick a cheaper model per-op via env.
export const AI_MODEL = process.env.TK_AI_MODEL || "claude-opus-5";

/** AI is optional — features degrade gracefully when no key is configured. */
export function aiEnabled(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let _client: Anthropic | null = null;
export function ai(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

/** Pull the first JSON object/array out of a model reply and parse it. */
export function parseJson<T>(text: string): T | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fence ? fence[1] : text).trim();
  const start = raw.search(/[[{]/);
  if (start === -1) return null;
  try {
    return JSON.parse(raw.slice(start)) as T;
  } catch {
    // last resort: trim to the last closing brace/bracket
    const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
    if (end > start) { try { return JSON.parse(raw.slice(start, end + 1)) as T; } catch { /* fall through */ } }
    return null;
  }
}

export function textOf(msg: Anthropic.Message): string {
  return msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
}
