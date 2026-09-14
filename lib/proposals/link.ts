// The public marketing-site origin that hosts the hidden proposal page. Override
// per environment (e.g. the staging site) with PUBLIC_SITE_URL; defaults to prod.
export const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || "https://turnkii.app").replace(/\/$/, "");

// The token lives in the URL fragment so it never reaches server logs or Referer
// headers — the page reads it client-side and calls the API with it.
export function proposalUrl(token: string) {
  return `${PUBLIC_SITE_URL}/p#${token}`;
}
