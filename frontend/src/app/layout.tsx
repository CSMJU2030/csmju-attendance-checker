import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { preload } from "react-dom";
import { CsmjuAppShell } from "@csmju2030/design-system";
import { AccessGate } from "@/components/shared/access-gate";
import { getMe } from "@/lib/api-server";
import { DISPLAY_NAME, PORTAL_URL, SUBSYSTEM_NAME } from "@/lib/config";
import { navFor } from "@/lib/permissions";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${DISPLAY_NAME} · CSMJU`, template: `%s · ${DISPLAY_NAME} · CSMJU` },
  description: "เช็คชื่อเข้าเรียนด้วยรหัสในห้องเรียนและตำแหน่งของอุปกรณ์",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Every screen depends on who is signed in - never cache.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Section 4.1: preload only the Thai 400/600 files; Latin loads on demand.
  preload("/fonts/ibm-plex-sans-thai-thai-400.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  preload("/fonts/ibm-plex-sans-thai-thai-600.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });

  const me = await getMe();
  const user = me.ok ? { email: me.data.email, coreRole: me.data.coreRole } : null;

  return (
    <html lang="th">
      <body>
        <CsmjuAppShell
          subsystemName={SUBSYSTEM_NAME}
          displayName={DISPLAY_NAME}
          nav={me.ok ? navFor(me.data.subsystemRole) : []}
          user={user}
          portalUrl={PORTAL_URL}
          logoutAction="/auth/logout"
        >
          {me.ok ? children : <AccessGate status={me.status} error={me.error} />}
        </CsmjuAppShell>
      </body>
    </html>
  );
}
