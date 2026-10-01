import { SubsystemRole } from './core-hub-identity';
import { Permission, ROLE_PERMISSIONS, can, canAny } from './permissions';

describe('Subsystem permission model (spec §15, §16)', () => {
  describe('STUDENT', () => {
    const role = SubsystemRole.STUDENT;

    it('can check in and read its own attendance', () => {
      expect(can(role, Permission.ATTENDANCE_CHECK_IN)).toBe(true);
      expect(can(role, Permission.ATTENDANCE_RECORD_READ_OWN)).toBe(true);
    });

    it('cannot manage class sections or attendance sessions', () => {
      expect(can(role, Permission.CLASS_SECTION_READ)).toBe(false);
      expect(can(role, Permission.CLASS_SECTION_CREATE)).toBe(false);
      expect(can(role, Permission.ATTENDANCE_SESSION_MANAGE_OWN)).toBe(false);
      expect(can(role, Permission.ATTENDANCE_SESSION_MANAGE_ANY)).toBe(false);
    });
  });

  describe('ALUMNI', () => {
    it('holds no permission in this subsystem', () => {
      expect(ROLE_PERMISSIONS[SubsystemRole.ALUMNI]).toHaveLength(0);
    });
  });

  describe('STAFF', () => {
    const role = SubsystemRole.STAFF;

    it('manages its own class sections and attendance sessions', () => {
      expect(can(role, Permission.CLASS_SECTION_READ)).toBe(true);
      expect(can(role, Permission.CLASS_SECTION_CREATE)).toBe(true);
      expect(can(role, Permission.CLASS_SECTION_UPDATE_OWN)).toBe(true);
      expect(can(role, Permission.CLASS_SECTION_DELETE_OWN)).toBe(true);
      expect(can(role, Permission.ATTENDANCE_SESSION_MANAGE_OWN)).toBe(true);
    });

    it('cannot manage sections of other staff - that stays with ADMIN', () => {
      expect(can(role, Permission.CLASS_SECTION_UPDATE_ANY)).toBe(false);
      expect(can(role, Permission.CLASS_SECTION_DELETE_ANY)).toBe(false);
      expect(can(role, Permission.ATTENDANCE_SESSION_MANAGE_ANY)).toBe(false);
    });

    it('does not check in as a student', () => {
      expect(can(role, Permission.ATTENDANCE_CHECK_IN)).toBe(false);
    });
  });

  describe('ADMIN', () => {
    it('holds every permission', () => {
      for (const permission of Object.values(Permission)) {
        expect(can(SubsystemRole.ADMIN, permission)).toBe(true);
      }
    });
  });

  it('canAny passes when at least one permission matches', () => {
    expect(
      canAny(SubsystemRole.STAFF, [
        Permission.ATTENDANCE_SESSION_MANAGE_ANY,
        Permission.ATTENDANCE_SESSION_MANAGE_OWN,
      ]),
    ).toBe(true);
    expect(
      canAny(SubsystemRole.STUDENT, [
        Permission.CLASS_SECTION_CREATE,
        Permission.ATTENDANCE_SESSION_MANAGE_OWN,
      ]),
    ).toBe(false);
  });

  it('defines permissions for every subsystem role', () => {
    for (const role of Object.values(SubsystemRole)) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });
});
