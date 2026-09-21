import { PUBLIC_SITE_URL } from "@/lib/proposals/link";

// Token in the URL fragment (never hits server logs); the page reads it client-side.
export function projectShowcaseUrl(token: string) {
  return `${PUBLIC_SITE_URL}/pj#${token}`;
}
