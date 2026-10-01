"use client";

import { signInHref } from "./config";
import { NETWORK_ERROR, readEnvelope } from "./envelope";
import type { ApiResult } from "./types";

/**
 * Browser-side call to this origin's `/api/*` (rewritten to the backend). The
 * HttpOnly SSO cookie travels automatically; no token is ever read by JS.
 * A 401 means the Core Hub session ended - start /auth/login again (auth-contract 7).
 */
export async function apiRequest<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }

  if (response.status === 401) {
    // Come back to this very page once Core Hub has signed the user in again.
    window.location.assign(signInHref(`${window.location.pathname}${window.location.search}`));
  }
  return readEnvelope<T>(response);
}
