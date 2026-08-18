import { getSiteConfig } from "@/lib/settings";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=30",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** Public: the site reads this to know which verticals to render. */
export async function GET() {
  const config = await getSiteConfig();
  return Response.json(config, { headers: CORS });
}
