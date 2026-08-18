import "server-only";

type Result = { ok: boolean; remaining: number };

// In-memory fixed-window fallback (single instance / dev). For distributed,
// serverless-safe limiting set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
const mem = new Map<string, { count: number; reset: number }>();

/**
 * Fixed-window rate limit. Returns { ok } — false when the caller is over the
 * limit for the window. Uses Upstash Redis when configured, else in-memory.
 */
export async function rateLimit(key: string, limit = 10, windowMs = 60_000): Promise<Result> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url, token });
      const k = `rl:${key}`;
      const count = await redis.incr(k);
      if (count === 1) await redis.expire(k, Math.ceil(windowMs / 1000));
      return { ok: count <= limit, remaining: Math.max(0, limit - count) };
    } catch {
      // fall through to in-memory on Redis error — never block a request on limiter failure
    }
  }

  const now = Date.now();
  const e = mem.get(key);
  if (!e || e.reset < now) {
    mem.set(key, { count: 1, reset: now + windowMs });
    if (mem.size > 5000) for (const [k, v] of mem) if (v.reset < now) mem.delete(k);
    return { ok: true, remaining: limit - 1 };
  }
  e.count++;
  return { ok: e.count <= limit, remaining: Math.max(0, limit - e.count) };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "local"
  );
}
