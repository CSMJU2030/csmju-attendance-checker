"use client";

import { SIGN_IN_URL } from "./config";
import { NETWORK_ERROR, readEnvelope } from "./envelope";
import type { ApiResult } from "./types";

/**
 * Browser-side call to this origin's `/api/*` (rewritten to the backend). The
 * HttpOnly SSO cookie travels automatically; no token is ever read by JS.
 * A 401 means the Core Hub session ended - restart SSO (auth-contract.md 7).
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
    window.location.assign(SIGN_IN_URL);
  }
  return readEnvelope<T>(response);
}
