import type { ApiError, ApiResult, PageMeta } from "./types";

/** Reads the `{ success, data, meta }` / `{ success:false, error }` envelope. */
export async function readEnvelope<T>(response: Response): Promise<ApiResult<T>> {
  const body = (await response.json().catch(() => null)) as
    | { success: true; data: T; meta?: PageMeta }
    | { success: false; error?: ApiError }
    | null;

  if (response.ok && body && body.success) {
    return { ok: true, status: response.status, data: body.data, meta: body.meta };
  }

  const error: ApiError =
    body && !body.success && body.error
      ? body.error
      : { code: "INTERNAL_ERROR", message: "Unexpected response" };
  return { ok: false, status: response.status, error };
}

export const NETWORK_ERROR: ApiError = { code: "NETWORK_ERROR", message: "network" };
