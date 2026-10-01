import { cookies } from "next/headers";
import { cache } from "react";
import { SSO_COOKIE_NAME, backendUrl } from "./config";
import { NETWORK_ERROR, readEnvelope } from "./envelope";
import type { ApiResult, Me } from "./types";

/**
 * GET from the backend while rendering a server component. The SSO cookie is
 * forwarded as-is; the backend verifies it on every request. Personal data is
 * never cached.
 */
export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const token = (await cookies()).get(SSO_COOKIE_NAME)?.value;
  try {
    const response = await fetch(`${backendUrl()}${path}`, {
      headers: token ? { Cookie: `${SSO_COOKIE_NAME}=${encodeURIComponent(token)}` } : {},
      cache: "no-store",
    });
    return await readEnvelope<T>(response);
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
}

/** The signed-in user. Deduplicated per request (layout + page share it). */
export const getMe = cache(async (): Promise<ApiResult<Me>> => apiGet<Me>("/api/v1/me"));
