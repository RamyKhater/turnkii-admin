import "server-only";

/**
 * Fire the site deploy hook to rebuild the public site so admin changes go live.
 * Best-effort and non-throwing: no-op when SITE_DEPLOY_HOOK_URL isn't set (local
 * dev), and swallows network errors so a content save never fails on this.
 */
export async function triggerSiteRebuild(): Promise<boolean> {
  const hook = process.env.SITE_DEPLOY_HOOK_URL;
  if (!hook) return false;
  try {
    const res = await fetch(hook, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}
