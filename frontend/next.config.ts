import type { NextConfig } from "next";

/**
 * The browser only ever talks to this origin. `/api/*` is passed through to the
 * NestJS backend unchanged (headers, cookies, status and body), so the SSO
 * cookie set on this origin reaches the backend and the backend stays the only
 * place that verifies tokens and enforces permissions.
 */
const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:3002").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
