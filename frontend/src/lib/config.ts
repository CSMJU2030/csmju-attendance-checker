/**
 * Environment-specific values (see frontend/.env.example). The localhost
 * fallbacks match the development ports in standards/docs/repo-structure.md.
 */
export const PORTAL_URL = (process.env.NEXT_PUBLIC_CORE_HUB_PORTAL_URL ?? "http://localhost:3100").replace(/\/+$/, "");

export const SUBSYSTEM_NAME = process.env.NEXT_PUBLIC_SUBSYSTEM_NAME ?? "csmju-attendance-checker";

export const DISPLAY_NAME = "ระบบเช็คชื่อเข้าเรียน";

/**
 * Core Hub portal's SSO launcher: it signs the user in if needed, asks the
 * Core API for a handoff and redirects to this subsystem's registered callback.
 */
export const SIGN_IN_URL = `${PORTAL_URL}/api/sso/${encodeURIComponent(SUBSYSTEM_NAME)}`;

/** Server-side only - never reaches the browser bundle. */
export function backendUrl(): string {
  return (process.env.BACKEND_URL ?? "http://localhost:3002").replace(/\/+$/, "");
}

/** Name of the HttpOnly cookie the backend sets on `/auth/callback`. */
export const SSO_COOKIE_NAME = "core_hub_access_token";
