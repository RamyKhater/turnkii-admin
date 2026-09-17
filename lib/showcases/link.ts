import { PUBLIC_SITE_URL } from "@/lib/proposals/link";

// Token in the URL fragment (never hits server logs); the page reads it client-side.
export function showcaseUrl(token: string) {
  return `${PUBLIC_SITE_URL}/w#${token}`;
}
