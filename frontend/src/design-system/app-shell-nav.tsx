"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuIcon, XIcon } from "./icons";
import { NAV_ICONS, type NavItem } from "./nav";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ nav, pathname, onNavigate }: { nav: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {nav.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = NAV_ICONS[item.icon];
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={
                "flex min-h-11 items-center gap-3 rounded-sm px-3 font-medium transition-colors duration-fast " +
                (active ? "bg-primary-soft text-primary" : "text-body hover:bg-primary-soft")
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
    <nav aria-label="เมนูระบบ" className="hidden w-sidebar shrink-0 border-r border-line bg-surface p-4 lg:block">
      <NavLinks nav={nav} pathname={pathname} />
    </nav>
  );
}

/** Menu button + drawer on mobile and tablet (section 6.2). */
export function MobileNav({ nav }: { nav: NavItem[] }) {
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
            <div className="flex justify-end">
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
