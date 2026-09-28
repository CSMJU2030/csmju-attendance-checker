/**
 * Central SSO session cookie.
 *
 * After Core Hub redirects an authenticated user to `/auth/callback`, the
 * subsystem stores the *Core Hub* access token in an HttpOnly cookie so the
 * browser can keep calling the subsystem's own APIs without a second login.
 *
 * The cookie only carries a Core Hub token that is verified on every request
 * exactly like a Bearer token - the subsystem still creates no session, no
 * password and no identity of its own.
 */
export const SSO_COOKIE_NAME = 'core_hub_access_token';

/** Reads one cookie out of a raw `Cookie:` header without extra dependencies. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) {
    return null;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');

    if (separator === -1) {
      continue;
    }

    if (part.slice(0, separator).trim() !== name) {
      continue;
    }

    const value = part.slice(separator + 1).trim();

    return value.length > 0 ? decodeURIComponent(value) : null;
  }

  return null;
}

/** Serialises the SSO cookie. `maxAgeSec` follows the Core Hub token lifetime. */
export function buildSsoCookie(
  token: string,
  maxAgeSec: number,
  secure: boolean,
): string {
  const attributes = [
    `${SSO_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
  ];

  if (secure) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}
