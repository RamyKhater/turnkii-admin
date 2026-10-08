// Shared helpers for the public account API (called cross-origin by the
// marketing site). Auth is by bearer token (owner session id), not cookies,
// so Access-Control-Allow-Origin can stay "*".
export const ACCOUNT_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
};

export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

export function jsonCors(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: ACCOUNT_CORS });
}

export function clientIpOf(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
