import { NextResponse, type NextRequest } from "next/server";
import { PORTAL_URL, SSO_COOKIE_NAME } from "@/lib/config";

/**
 * POST /auth/logout - forgets this subsystem's copy of the Core Hub token and
 * returns to the Core Hub portal. v1.0 has no central SSO logout
 * (auth-contract.md, known limitations): the Core Hub session itself stays.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(PORTAL_URL, { status: 303 });
  response.cookies.set(SSO_COOKIE_NAME, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 0,
  });
  return response;
}
