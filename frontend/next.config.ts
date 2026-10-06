import path from "node:path";
import type { NextConfig } from "next";

/**
 * The browser only ever talks to this origin. `/api/*` and `/auth/*` are passed
 * through to the NestJS backend unchanged (headers, cookies, status and body),
 * so the SSO cookie the backend sets on this origin comes back to it, and the
 * backend stays the only place that verifies tokens and enforces permissions.
 */
const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:4202").replace(/\/+$/, "");

// Sent with every page. HSTS is added to the built server (next build runs
// with NODE_ENV=production); browsers only honour it over https, which the
// reverse proxy in front of this server provides, and ignore it on localhost.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Check-in needs the device location; nothing here uses the camera or microphone.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // deployment.md 3: the image ships only the traced standalone server (DEP-04)
  output: "standalone",
  // pnpm keeps dependencies at the workspace root (the repo root), so tracing
  // has to start there or the standalone bundle misses them
  outputFileTracingRoot: path.join(__dirname, ".."),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    // auth-contract 5: the backend owns sign-in (anti-forgery state, callback,
    // cookie) and sign-out; the browser only ever sees this origin.
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/auth/login", destination: `${backendUrl}/auth/login` },
      { source: "/auth/callback", destination: `${backendUrl}/auth/callback` },
      { source: "/auth/logout", destination: `${backendUrl}/auth/logout` },
    ];
  },
};

export default nextConfig;
