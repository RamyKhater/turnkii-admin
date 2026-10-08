import { getOwnerFromToken } from "@/lib/owner/session";
import { ACCOUNT_CORS, jsonCors, bearer } from "@/lib/account/http";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: ACCOUNT_CORS });
}

export async function GET(req: Request) {
  const owner = await getOwnerFromToken(bearer(req));
  if (!owner) return jsonCors({ ok: false, error: "Not signed in." }, 401);
  return jsonCors({
    ok: true,
    owner: {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      marketingConsent: owner.marketingConsent,
    },
  });
}
