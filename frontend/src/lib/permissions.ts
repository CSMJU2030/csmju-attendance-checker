import type { NavItem } from "@/csmju";
import type { SubsystemRole } from "./types";

/**
 * UI-only mirror of backend/src/auth/permissions.ts. It decides what to SHOW;
 * the backend still enforces every permission (ui-design-system.md 10).
 */
export type Permission =
  | "class-section:read"
  | "class-section:create"
  | "class-section:update:any"
  | "class-section:update:own"
  | "class-section:delete:any"
  | "class-section:delete:own"
  | "attendance-session:manage:any"
  | "attendance-session:manage:own"
  | "attendance:check-in"
  | "attendance-record:read:own";

const STAFF: Permission[] = [
  "class-section:read",
  "class-section:create",
  "class-section:update:own",
  "class-section:delete:own",
  "attendance-session:manage:own",
];

const ROLE_PERMISSIONS: Record<SubsystemRole, Permission[]> = {
  STUDENT: ["attendance:check-in", "attendance-record:read:own"],
  ALUMNI: [],
  STAFF,
  ADMIN: [
    ...STAFF,
    "class-section:update:any",
    "class-section:delete:any",
    "attendance-session:manage:any",
    "attendance:check-in",
    "attendance-record:read:own",
  ],
};

export function can(role: SubsystemRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** May this user change a section? `:own` is checked against the owner. */
export function canManageSection(
  me: { id: string; subsystemRole: SubsystemRole },
  ownerCoreUserId: string,
  action: "update" | "delete" | "manage",
): boolean {
  const any: Permission = action === "manage" ? "attendance-session:manage:any" : `class-section:${action}:any`;
  const own: Permission = action === "manage" ? "attendance-session:manage:own" : `class-section:${action}:own`;
  return can(me.subsystemRole, any) || (can(me.subsystemRole, own) && me.id === ownerCoreUserId);
}

export function navFor(role: SubsystemRole): NavItem[] {
  // Icon names come from the central CsmjuAppShell (NavIconName).
  const nav: NavItem[] = [{ label: "ภาพรวม", labelEn: "Overview", href: "/", icon: "dashboard" }];
  if (can(role, "attendance:check-in")) {
    nav.push({ label: "เช็คชื่อ", labelEn: "Check in", href: "/check-in", icon: "event" });
  }
  if (can(role, "attendance-record:read:own")) {
    nav.push({ label: "ประวัติการเช็คชื่อ", labelEn: "History", href: "/attendance-records", icon: "description" });
  }
  if (can(role, "class-section:read")) {
    nav.push({ label: "กลุ่มเรียน", labelEn: "Sections", href: "/class-sections", icon: "school" });
  }
  return nav;
}
