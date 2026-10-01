import path from "node:path";
import type { NextConfig } from "next";

/**
 * The browser only ever talks to this origin. `/api/*` and `/auth/*` are passed
 * through to the NestJS backend unchanged (headers, cookies, status and body),
 * so the SSO cookie the backend sets on this origin comes back to it, and the
 * backend stays the only place that verifies tokens and enforces permissions.
 */
const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:3002").replace(/\/+$/, "");

// The Docker image builds a self-contained server (frontend/Dockerfile sets
// NEXT_OUTPUT=standalone). Tracing starts at the repo root because pnpm keeps
// the dependency store there. `next build` always runs inside frontend/.
const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(standalone ? { output: "standalone", outputFileTracingRoot: path.resolve(process.cwd(), "..") } : {}),
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
