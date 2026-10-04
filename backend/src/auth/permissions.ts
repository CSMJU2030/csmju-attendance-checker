import { SubsystemRole } from './core-hub-identity';

/**
 * Subsystem permissions (spec §16).
 *
 *   Core JWT -> Core Role -> Subsystem Role -> Permission -> Business Operation
 *
 * Business code asks for a permission, never for `role === 'admin'`.
 * `:own` variants are scope hints: the guard lets the request through and the
 * service performs the ownership check against business data.
 */
export enum Permission {
  CLASS_SECTION_READ = 'class-section:read',
  CLASS_SECTION_CREATE = 'class-section:create',
  CLASS_SECTION_UPDATE_ANY = 'class-section:update:any',
  CLASS_SECTION_UPDATE_OWN = 'class-section:update:own',
  CLASS_SECTION_DELETE_ANY = 'class-section:delete:any',
  CLASS_SECTION_DELETE_OWN = 'class-section:delete:own',

  /** Open, view, rotate-code and close attendance sessions. */
  ATTENDANCE_SESSION_MANAGE_ANY = 'attendance-session:manage:any',
  ATTENDANCE_SESSION_MANAGE_OWN = 'attendance-session:manage:own',

  /** Look up active students in Core Hub to build a class section roster. */
  PEOPLE_SEARCH = 'people:search',

  ATTENDANCE_CHECK_IN = 'attendance:check-in',
  ATTENDANCE_RECORD_READ_OWN = 'attendance-record:read:own',
}

const STUDENT_PERMISSIONS: Permission[] = [
  Permission.ATTENDANCE_CHECK_IN,
  Permission.ATTENDANCE_RECORD_READ_OWN,
];

/** Alumni are not registered for this subsystem in the Core Hub; no access. */
const ALUMNI_PERMISSIONS: Permission[] = [];

const STAFF_PERMISSIONS: Permission[] = [
  Permission.CLASS_SECTION_READ,
  Permission.CLASS_SECTION_CREATE,
  Permission.CLASS_SECTION_UPDATE_OWN,
  Permission.CLASS_SECTION_DELETE_OWN,
  Permission.ATTENDANCE_SESSION_MANAGE_OWN,
  Permission.PEOPLE_SEARCH,
];

const ADMIN_PERMISSIONS: Permission[] = Object.values(Permission);

export const ROLE_PERMISSIONS: Readonly<Record<SubsystemRole, readonly Permission[]>> =
  Object.freeze({
    [SubsystemRole.STUDENT]: Object.freeze(STUDENT_PERMISSIONS),
    [SubsystemRole.ALUMNI]: Object.freeze(ALUMNI_PERMISSIONS),
    [SubsystemRole.STAFF]: Object.freeze(STAFF_PERMISSIONS),
    [SubsystemRole.ADMIN]: Object.freeze(ADMIN_PERMISSIONS),
  });

/** Does this subsystem role hold the given permission? */
export function can(role: SubsystemRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Does this subsystem role hold at least one of the given permissions? */
export function canAny(role: SubsystemRole, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}
