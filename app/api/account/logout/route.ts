import { destroyOwnerSessionToken } from "@/lib/owner/session";
import { ACCOUNT_CORS, jsonCors, bearer } from "@/lib/account/http";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: ACCOUNT_CORS });
}

export async function POST(req: Request) {
  await destroyOwnerSessionToken(bearer(req));
  return jsonCors({ ok: true });
}
