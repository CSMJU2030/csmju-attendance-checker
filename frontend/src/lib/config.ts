/**
 * Environment-specific values (see frontend/.env.example).
 */

/**
 * Must match `name` in subsystem.yaml and the Core Hub Subsystem Registry.
 * SUBSYSTEM_ID is what the server gives the web container (deployment.md 4.2).
 */
export const SUBSYSTEM_NAME = process.env.SUBSYSTEM_ID ?? "csmju-attendance-checker";

/**
 * Core Hub's web app: the "กลับ CSMJU Portal" link. Read on the server (the
 * web container gets CORE_HUB_WEB_URL, deployment.md 4.2); a plain URL.
 */
export const CORE_HUB_WEB_URL = (process.env.CORE_HUB_WEB_URL ?? "https://csmju2030.jowave.com").replace(/\/+$/, "");

export const DISPLAY_NAME = "ระบบเช็คชื่อเข้าเรียน";

/** Short form for the central shell's mobile top bar, which has room for about 12 Thai characters. */
export const SHELL_NAME = "ระบบเช็คชื่อ";

/**
 * Where every sign-in starts: this subsystem's own GET /auth/login
 * (auth-contract 5), passed on to the backend by next.config.ts. It mints the
 * anti-forgery state, goes to Core Hub, and comes back to `next`.
 */
export function signInHref(next = "/"): string {
  return `/auth/login?next=${encodeURIComponent(next)}`;
}

/** Server-side only - never reaches the browser bundle. */
export function backendUrl(): string {
  return (process.env.BACKEND_URL ?? "http://127.0.0.1:4202").replace(/\/+$/, "");
}

/**
 * The HttpOnly session cookie the backend sets at /auth/callback:
 * `<subsystem name>_access_token` with `-` as `_` (vocabulary.json ssoCookies).
 */
export const SSO_COOKIE_NAME = `${SUBSYSTEM_NAME.replace(/-/g, "_")}_access_token`;
