import Link from "next/link";
import type { ReactNode } from "react";
import { MobileNav, SidebarNav } from "./app-shell-nav";
import { RoleBadge } from "./components";
import { ArrowLeftIcon, LogOutIcon } from "./icons";
import type { NavItem } from "./nav";

export interface CsmjuUser {
  email: string;
  coreRole: string;
}

/**
 * LOCAL STAND-IN for `<CsmjuAppShell>` (section 5.1): skip link, top bar with
 * "back to dashboard", subsystem name, user menu and sign-out, plus the
 * sidebar/drawer. Pages render only their own content inside `<main>`.
 */
export function CsmjuAppShell({
  subsystemName,
  displayName,
  nav,
  user,
  portalUrl,
  logoutAction,
  children,
}: {
  subsystemName: string;
  displayName: string;
  nav: NavItem[];
  user: CsmjuUser | null;
  portalUrl: string;
  /** POST endpoint that clears this subsystem's session cookie. */
  logoutAction: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas" data-subsystem={subsystemName}>
      <a
        href="#main"
        className="sr-only z-toast rounded-sm bg-primary px-4 py-2 text-inverse focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>

      <header className="sticky top-0 z-header flex h-header items-center gap-2 border-b border-line bg-surface px-4 md:px-6">
        {user ? <MobileNav nav={nav} displayName={displayName} /> : null}
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="rounded-sm bg-primary px-2 font-heading text-sm font-semibold text-inverse" lang="en">
            CSMJU
          </span>
          <span className="truncate font-heading font-semibold text-ink">{displayName}</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={portalUrl}
            className="hidden min-h-11 items-center gap-1 rounded-sm px-3 text-sm font-semibold text-primary hover:bg-primary-soft sm:inline-flex"
          >
            <ArrowLeftIcon size={16} />
            กลับหน้าหลัก
          </a>
          {user ? (
            <details className="relative">
              <summary
                className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm px-2 hover:bg-primary-soft"
                aria-label="เมนูผู้ใช้"
              >
                <span
                  aria-hidden
                  className="flex size-8 items-center justify-center rounded-full bg-primary-soft font-semibold uppercase text-primary"
                >
                  {user.email.charAt(0)}
                </span>
                <span className="hidden max-w-48 truncate text-sm text-body md:inline">{user.email}</span>
              </summary>
              <div className="absolute right-0 z-popover mt-2 flex w-72 flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-md">
                <div className="flex flex-col gap-1">
                  <p className="break-words text-sm text-ink">{user.email}</p>
                  <div>
                    <RoleBadge coreRole={user.coreRole} />
                  </div>
                </div>
                <a href={portalUrl} className="text-sm font-semibold text-primary hover:underline sm:hidden">
                  กลับหน้าหลัก
                </a>
                <form action={logoutAction} method="post">
                  <button
                    type="submit"
                    className="flex min-h-11 w-full items-center gap-2 rounded-sm px-3 font-semibold text-danger hover:bg-danger-soft"
                  >
                    <LogOutIcon size={16} />
                    ออกจากระบบ
                  </button>
                </form>
              </div>
            </details>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1">
        {user ? <SidebarNav nav={nav} /> : null}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1">
          <div className="mx-auto flex max-w-container flex-col gap-8 px-4 py-6 md:px-6 md:py-8 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
