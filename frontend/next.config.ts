import path from "node:path";
import type { NextConfig } from "next";

/**
 * The browser only ever talks to this origin. `/api/*` is passed through to the
 * NestJS backend unchanged (headers, cookies, status and body), so the SSO
 * cookie set on this origin reaches the backend and the backend stays the only
 * place that verifies tokens and enforces permissions.
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
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
