import { NextResponse, type NextRequest } from "next/server";
import { backendUrl } from "@/lib/config";

/**
 * GET /auth/callback - the callback URL registered in the Core Hub Subsystem
 * Registry for this subsystem.
 *
 * The backend's own `/auth/callback` does all the work (JWKS verification,
 * role mapping, HttpOnly cookie) and answers JSON. This route forwards the
 * query to it unchanged and, on success, hands the browser the backend's
 * Set-Cookie with a redirect into the app. Any rejection (400/401/403) is
 * passed through as the backend answered it, and no cookie is set.
 */
export async function GET(request: NextRequest) {
  const target = new URL(`${backendUrl()}/auth/callback`);
  target.search = request.nextUrl.search;

  let upstream: Response;
  try {
    upstream = await fetch(target, { cache: "no-store", redirect: "manual" });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Backend unavailable" } },
      { status: 502 },
    );
  }

  const setCookie = upstream.headers.get("set-cookie");
  if (!upstream.ok || !setCookie) {
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  const response = NextResponse.redirect(new URL("/", request.url), { status: 302 });
  response.headers.set("set-cookie", setCookie);
  response.headers.set("cache-control", "no-store");
  return response;
}
