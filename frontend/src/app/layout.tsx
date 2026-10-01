import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { CsmjuAppShell } from "@/csmju";
import { AccessGate } from "@/components/shared/access-gate";
import { CORE_ROLE_LABEL } from "@/components/shared/kit";
import { getMe } from "@/lib/api-server";
import { DISPLAY_NAME, SHELL_NAME } from "@/lib/config";
import { navFor } from "@/lib/permissions";
import "./globals.css";

// ui-design-system.md 4.1: next/font self-hosts the files at build time and
// serves them from this origin - the browser never calls Google.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
});

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

/** Two letters for the avatar, from the part of the e-mail before "@". */
function initialsOf(email: string): string {
  return (email.split("@")[0] || "?").slice(0, 2).toUpperCase();
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const me = await getMe();

  return (
    <html lang="th" className={`${jakarta.variable} ${notoSansThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-on-surface">
        {/* Section 12.1: the central shell has no skip link yet; its <main> is #main. */}
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-primary-container px-4 py-2 text-label-md text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          ข้ามไปยังเนื้อหาหลัก
        </a>
        {me.ok ? (
          <CsmjuAppShell
            displayName={SHELL_NAME}
            nav={navFor(me.data.subsystemRole)}
            user={{
              initials: initialsOf(me.data.email),
              roleLabel: CORE_ROLE_LABEL[me.data.coreRole] ?? me.data.coreRole,
            }}
            // The shell renders a plain link; sign-out itself is POST /auth/logout,
            // so the link opens a confirmation page that posts the form.
            logoutHref="/signout"
          >
            {children}
          </CsmjuAppShell>
        ) : (
          // Not signed in: there is no user for the shell yet, only the way in.
          <main id="main" className="flex min-h-dvh flex-col px-4 py-8 md:py-16">
            <AccessGate status={me.status} error={me.error} />
          </main>
        )}
      </body>
    </html>
  );
}
