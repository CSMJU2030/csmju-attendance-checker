import { SubsystemRole } from './core-hub-identity';
import { Permission, ROLE_PERMISSIONS, can, canAny } from './permissions';

describe('Subsystem permission model (spec §15, §16)', () => {
  describe('STUDENT', () => {
    const role = SubsystemRole.STUDENT;

    it('can read its own profile, view courses and enroll itself', () => {
      expect(can(role, Permission.STUDENT_READ_OWN)).toBe(true);
      expect(can(role, Permission.COURSE_READ)).toBe(true);
      expect(can(role, Permission.ENROLLMENT_CREATE_OWN)).toBe(true);
    });

    it('cannot read other students, create courses or manage other enrollments', () => {
      expect(can(role, Permission.STUDENT_READ_ANY)).toBe(false);
      expect(can(role, Permission.STUDENT_UPDATE_ANY)).toBe(false);
      expect(can(role, Permission.STUDENT_CREATE)).toBe(false);
      expect(can(role, Permission.COURSE_CREATE)).toBe(false);
      expect(can(role, Permission.ENROLLMENT_CREATE_ANY)).toBe(false);
    });
  });

  describe('ALUMNI', () => {
    it('is read-only', () => {
      const role = SubsystemRole.ALUMNI;
      expect(can(role, Permission.STUDENT_READ_OWN)).toBe(true);
      expect(can(role, Permission.COURSE_READ)).toBe(true);
      expect(can(role, Permission.ENROLLMENT_CREATE_OWN)).toBe(false);
      expect(can(role, Permission.STUDENT_UPDATE_OWN)).toBe(false);
    });
  });

  describe('STAFF', () => {
    const role = SubsystemRole.STAFF;

    it('manages students, courses and enrollments', () => {
      expect(can(role, Permission.STUDENT_READ_ANY)).toBe(true);
      expect(can(role, Permission.STUDENT_CREATE)).toBe(true);
      expect(can(role, Permission.COURSE_CREATE)).toBe(true);
      expect(can(role, Permission.ENROLLMENT_UPDATE_ANY)).toBe(true);
    });

    it('cannot delete courses - that stays with ADMIN', () => {
      expect(can(role, Permission.COURSE_DELETE)).toBe(false);
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
      canAny(SubsystemRole.STUDENT, [Permission.STUDENT_READ_ANY, Permission.STUDENT_READ_OWN]),
    ).toBe(true);
    expect(
      canAny(SubsystemRole.ALUMNI, [Permission.COURSE_CREATE, Permission.COURSE_DELETE]),
    ).toBe(false);
  });

  it('defines permissions for every subsystem role', () => {
    for (const role of Object.values(SubsystemRole)) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });
});
