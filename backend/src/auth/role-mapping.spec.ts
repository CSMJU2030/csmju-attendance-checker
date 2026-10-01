import { SubsystemRole } from './core-hub-identity';
import { mapCoreRoleToSubsystemRole } from './role-mapping';

describe('Core role -> subsystem role mapping (spec §14)', () => {
  it.each([
    ['student', SubsystemRole.STUDENT],
    ['lecturer', SubsystemRole.STAFF],
    ['staff', SubsystemRole.STAFF],
    ['admin', SubsystemRole.ADMIN],
  ])('maps core role "%s" to %s', (coreRole, expected) => {
    expect(mapCoreRoleToSubsystemRole(coreRole)).toBe(expected);
  });

  it('is case and whitespace tolerant', () => {
    expect(mapCoreRoleToSubsystemRole('  STAFF ')).toBe(SubsystemRole.STAFF);
  });

  it('does not grant alumni or guest access to this subsystem', () => {
    expect(mapCoreRoleToSubsystemRole('alumni')).toBeNull();
    expect(mapCoreRoleToSubsystemRole('guest')).toBeNull();
  });

  it('returns null for a Core Hub role this subsystem does not know', () => {
    expect(mapCoreRoleToSubsystemRole('finance-officer')).toBeNull();
  });

  it('returns null when the token carries no role claim', () => {
    expect(mapCoreRoleToSubsystemRole(undefined)).toBeNull();
  });
});
