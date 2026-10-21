import { type Instrumentation } from "next";

// In-memory throttle so one recurring fault can't flood inboxes. Per server
// instance (serverless): good enough to collapse a storm into ~one email per
// signature per window. Signature = route + first line of the message.
const WINDOW_MS = 15 * 60 * 1000;
const lastSent = new Map<string, number>();

function throttled(sig: string): boolean {
  const now = Date.now();
  const prev = lastSent.get(sig) ?? 0;
  if (now - prev < WINDOW_MS) return true;
  lastSent.set(sig, now);
  if (lastSent.size > 500) for (const [k, t] of lastSent) if (now - t > WINDOW_MS) lastSent.delete(k);
  return false;
}

/**
 * Alert the team on ANY uncaught server error, across every page and API route.
 * Next's own control-flow throws (redirect / notFound / forbidden, all carrying
 * a NEXT_* digest) are not faults, so they're skipped. Best-effort and throttled
 * so it never adds load or noise to a failing request.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const digest = (err && typeof err === "object" && "digest" in err) ? String((err as { digest?: unknown }).digest) : "";
    if (digest.startsWith("NEXT_")) return; // redirect / notFound / fallback — not a fault
    const message = err instanceof Error ? err.message : String(err);
    if (/NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK/.test(message)) return;

    const path = request?.path ?? "unknown";
    const sig = `${path}|${message.slice(0, 120)}`;
    if (throttled(sig)) return;

    const stack = err instanceof Error && err.stack ? err.stack.split("\n").slice(0, 4).join("\n") : "";
    const { alertOps } = await import("@/lib/alerts");
    await alertOps({
      subject: `⚠ Turnkii server error: ${path}`,
      heading: "A server error was thrown",
      intro: "An unhandled error occurred on the admin. This is the first alert for it in the last 15 minutes.",
      rows: [
        ["Path", path],
        ["Method", request?.method ?? "—"],
        ["Where", context?.routePath ?? context?.routerKind ?? "—"],
        ["Error", message],
        ["Digest", digest || "—"],
        ["When", new Date().toISOString()],
        ...(stack ? ([["Stack", stack]] as [string, string][]) : []),
      ],
    });
  } catch {
    // Monitoring must never make a failing request worse.
  }
};
