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
  STUDENT_READ_ANY = 'student:read:any',
  STUDENT_READ_OWN = 'student:read:own',
  STUDENT_CREATE = 'student:create',
  STUDENT_UPDATE_ANY = 'student:update:any',
  STUDENT_UPDATE_OWN = 'student:update:own',

  COURSE_READ = 'course:read',
  COURSE_CREATE = 'course:create',
  COURSE_UPDATE = 'course:update',
  COURSE_DELETE = 'course:delete',

  ENROLLMENT_READ_ANY = 'enrollment:read:any',
  ENROLLMENT_READ_OWN = 'enrollment:read:own',
  ENROLLMENT_CREATE_ANY = 'enrollment:create:any',
  ENROLLMENT_CREATE_OWN = 'enrollment:create:own',
  ENROLLMENT_UPDATE_ANY = 'enrollment:update:any',
  ENROLLMENT_UPDATE_OWN = 'enrollment:update:own',
}

const STUDENT_PERMISSIONS: Permission[] = [
  Permission.STUDENT_READ_OWN,
  Permission.STUDENT_UPDATE_OWN,
  Permission.COURSE_READ,
  Permission.ENROLLMENT_READ_OWN,
  Permission.ENROLLMENT_CREATE_OWN,
  Permission.ENROLLMENT_UPDATE_OWN,
];

const ALUMNI_PERMISSIONS: Permission[] = [
  Permission.STUDENT_READ_OWN,
  Permission.COURSE_READ,
  Permission.ENROLLMENT_READ_OWN,
];

const STAFF_PERMISSIONS: Permission[] = [
  Permission.STUDENT_READ_ANY,
  Permission.STUDENT_READ_OWN,
  Permission.STUDENT_CREATE,
  Permission.STUDENT_UPDATE_ANY,
  Permission.STUDENT_UPDATE_OWN,
  Permission.COURSE_READ,
  Permission.COURSE_CREATE,
  Permission.COURSE_UPDATE,
  Permission.ENROLLMENT_READ_ANY,
  Permission.ENROLLMENT_READ_OWN,
  Permission.ENROLLMENT_CREATE_ANY,
  Permission.ENROLLMENT_CREATE_OWN,
  Permission.ENROLLMENT_UPDATE_ANY,
  Permission.ENROLLMENT_UPDATE_OWN,
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
