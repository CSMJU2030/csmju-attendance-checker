"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuIcon, XIcon } from "./icons";
import { NAV_ICONS, type NavItem } from "./nav";

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") {
    return pathname === "/";
  }
  return [item.href, ...(item.match ?? [])].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function NavLinks({ nav, pathname, onNavigate }: { nav: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {nav.map((item) => {
        const active = isActive(pathname, item);
        const Icon = NAV_ICONS[item.icon];
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={
                "relative flex min-h-11 items-center gap-3 rounded-sm px-3 font-semibold transition-colors duration-fast " +
                (active
                  ? "bg-primary-soft text-primary before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-primary"
                  : "text-body hover:bg-primary-soft hover:text-ink")
              }
            >
              <Icon />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Full sidebar on desktop (section 6.2). */
export function SidebarNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูระบบ" className="hidden w-sidebar shrink-0 border-r border-line bg-surface lg:block">
      <div className="sticky top-header flex flex-col gap-2 p-4">
        <p className="px-3 pb-1 pt-2 text-sm font-semibold text-body">เมนู</p>
        <NavLinks nav={nav} pathname={pathname} />
      </div>
    </nav>
  );
}

/** Menu button + drawer on mobile and tablet (section 6.2). */
export function MobileNav({ nav, displayName }: { nav: NavItem[]; displayName?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (nav.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="เปิดเมนู"
        aria-expanded={open}
        aria-controls="csmju-drawer"
        className="inline-flex size-11 items-center justify-center rounded-sm text-body hover:bg-primary-soft lg:hidden"
      >
        <MenuIcon />
      </button>

      {open ? (
        <div className="fixed inset-0 z-drawer lg:hidden">
          <button
            type="button"
            aria-label="ปิดเมนู"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-surface-inverse opacity-50"
          />
          <nav
            id="csmju-drawer"
            aria-label="เมนูระบบ"
            className="relative flex h-full w-72 max-w-[85vw] flex-col gap-4 bg-surface p-4 shadow-lg"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="px-3 font-heading font-semibold text-ink">{displayName}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ปิดเมนู"
                autoFocus
                className="inline-flex size-11 items-center justify-center rounded-sm text-body hover:bg-primary-soft"
              >
                <XIcon />
              </button>
            </div>
            <NavLinks nav={nav} pathname={pathname} onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      ) : null}
    </>
  );
}
