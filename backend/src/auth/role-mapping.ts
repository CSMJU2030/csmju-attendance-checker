import { SubsystemRole } from './core-hub-identity';

/**
 * Core Hub role -> Subsystem role (spec §14).
 *
 *   Core Hub Role      Subsystem Role
 *   ---------------------------------
 *   student            STUDENT
 *   lecturer           STAFF
 *   staff              STAFF
 *   admin              ADMIN
 *   alumni · guest     (none - 403)
 *
 * The mapping is explicit and lives only in this subsystem. The Core Hub role
 * vocabulary can change without changing subsystem authorization logic - only
 * this table changes.
 */
export const CORE_ROLE_TO_SUBSYSTEM_ROLE: Readonly<Record<string, SubsystemRole>> = Object.freeze({
  student: SubsystemRole.STUDENT,
  // Since standards 1.6.0 lecturers carry `lecturer`, not `staff`; both run class sections.
  lecturer: SubsystemRole.STAFF,
  staff: SubsystemRole.STAFF,
  admin: SubsystemRole.ADMIN,
  // alumni and guest are not registered for this subsystem: they get 403.
});

/**
 * Returns the subsystem role for a Core Hub role, or `null` when the Core Hub
 * role has no meaning in this subsystem (authenticated, but not authorized).
 */
export function mapCoreRoleToSubsystemRole(coreRole: string | undefined): SubsystemRole | null {
  if (typeof coreRole !== 'string') {
    return null;
  }
  return CORE_ROLE_TO_SUBSYSTEM_ROLE[coreRole.trim().toLowerCase()] ?? null;
}
