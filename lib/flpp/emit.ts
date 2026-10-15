// Push an event to FLPP — the return leg of the Turnkii↔FLPP seam. Best-effort:
// no-op when the integration isn't configured, and never throws into the caller
// (a failed push must not break the admin action that triggered it).
export async function emitToFlpp(
  name: string,
  ticketRef: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const base = process.env.FLPP_API_URL;
  const token = process.env.FLPP_INBOUND_TOKEN;
  if (!base || !token) return;
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  if (process.env.FLPP_BYPASS_TOKEN) headers["x-vercel-protection-bypass"] = process.env.FLPP_BYPASS_TOKEN;
  try {
    await fetch(`${base}/api/turnkii/events`, { method: "POST", headers, body: JSON.stringify({ name, ticketRef, payload }) });
  } catch {
    // best-effort
  }
}
