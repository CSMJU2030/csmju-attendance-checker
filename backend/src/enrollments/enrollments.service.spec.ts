import { EnrollmentStatus } from '../../generated/prisma/client';
import { AuthEventsLogger } from '../auth/auth-events.logger';
import { CoreHubIdentity, SubsystemRole } from '../auth/core-hub-identity';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentsService } from './enrollments.service';

const OWN_STUDENT = {
  id: '11111111-1111-4111-8111-111111111111',
  coreUserId: 'user-001',
  studentCode: 'CS67001',
};
const OTHER_STUDENT_ID = '22222222-2222-4222-8222-222222222222';
const COURSE = { id: '33333333-3333-4333-8333-333333333333', courseCode: 'CS101' };

function user(role: SubsystemRole, id = 'user-001'): CoreHubIdentity {
  return { id, email: `${id}@core.local`, coreRole: role.toLowerCase(), subsystemRole: role };
}

describe('EnrollmentsService - business rules (spec §25, §26)', () => {
  let prisma: {
    student: { findUnique: jest.Mock };
    course: { findUnique: jest.Mock };
    enrollment: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: EnrollmentsService;

  beforeEach(() => {
    prisma = {
      student: { findUnique: jest.fn() },
      course: { findUnique: jest.fn().mockResolvedValue(COURSE) },
      enrollment: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'e1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'e1', ...data })),
      },
    };
    service = new EnrollmentsService(prisma as unknown as PrismaService, new AuthEventsLogger());

    // Default: the Core Hub identity `user-001` is linked to OWN_STUDENT.
    prisma.student.findUnique.mockImplementation(({ where }: { where: Record<string, string> }) => {
      if (where.coreUserId === 'user-001') return Promise.resolve(OWN_STUDENT);
      if (where.id === OWN_STUDENT.id) return Promise.resolve(OWN_STUDENT);
      if (where.id === OTHER_STUDENT_ID) return Promise.resolve({ id: OTHER_STUDENT_ID, studentCode: 'CS67002' });
      return Promise.resolve(null);
    });
  });

  describe('create', () => {
    it('lets a STUDENT enroll themselves', async () => {
      await expect(
        service.create(user(SubsystemRole.STUDENT), {
          studentId: OWN_STUDENT.id,
          courseId: COURSE.id,
        }),
      ).resolves.toMatchObject({ status: EnrollmentStatus.ENROLLED });
    });

    it('stops a STUDENT enrolling on behalf of another student (403)', async () => {
      await expect(
        service.create(user(SubsystemRole.STUDENT), {
          studentId: OTHER_STUDENT_ID,
          courseId: COURSE.id,
        }),
      ).rejects.toMatchObject({ status: 403 });

      expect(prisma.enrollment.create).not.toHaveBeenCalled();
    });

    it('lets STAFF enroll any student', async () => {
      await expect(
        service.create(user(SubsystemRole.STAFF, 'user-003'), {
          studentId: OTHER_STUDENT_ID,
          courseId: COURSE.id,
        }),
      ).resolves.toBeDefined();
    });

    it('rejects a duplicate ACTIVE enrollment with 409', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'e-existing',
        studentId: OWN_STUDENT.id,
        courseId: COURSE.id,
        status: EnrollmentStatus.ENROLLED,
      });

      await expect(
        service.create(user(SubsystemRole.STUDENT), {
          studentId: OWN_STUDENT.id,
          courseId: COURSE.id,
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('reactivates a previously dropped enrollment instead of duplicating it', async () => {
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'e-dropped',
        studentId: OWN_STUDENT.id,
        courseId: COURSE.id,
        status: EnrollmentStatus.DROPPED,
      });

      await expect(
        service.create(user(SubsystemRole.STUDENT), {
          studentId: OWN_STUDENT.id,
          courseId: COURSE.id,
        }),
      ).resolves.toMatchObject({ status: EnrollmentStatus.ENROLLED });

      expect(prisma.enrollment.update).toHaveBeenCalled();
      expect(prisma.enrollment.create).not.toHaveBeenCalled();
    });

    it('rejects an enrollment referencing a missing student (400)', async () => {
      await expect(
        service.create(user(SubsystemRole.STAFF, 'user-003'), {
          studentId: '99999999-9999-4999-8999-999999999999',
          courseId: COURSE.id,
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects an enrollment referencing a missing course (400)', async () => {
      prisma.course.findUnique.mockResolvedValue(null);

      await expect(
        service.create(user(SubsystemRole.STAFF, 'user-003'), {
          studentId: OWN_STUDENT.id,
          courseId: '99999999-9999-4999-8999-999999999999',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('denies a Core Hub user with no linked student record (403)', async () => {
      prisma.student.findUnique.mockResolvedValue(null);

      await expect(
        service.create(user(SubsystemRole.STUDENT, 'user-404'), {
          studentId: OWN_STUDENT.id,
          courseId: COURSE.id,
        }),
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'e1',
        studentId: OWN_STUDENT.id,
        courseId: COURSE.id,
        status: EnrollmentStatus.ENROLLED,
      });
    });

    it('lets a STUDENT drop their own enrollment', async () => {
      await expect(
        service.update(user(SubsystemRole.STUDENT), 'e1', { status: EnrollmentStatus.DROPPED }),
      ).resolves.toMatchObject({ status: EnrollmentStatus.DROPPED });
    });

    it('stops a STUDENT marking their own enrollment COMPLETED (403)', async () => {
      await expect(
        service.update(user(SubsystemRole.STUDENT), 'e1', { status: EnrollmentStatus.COMPLETED }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("stops a STUDENT touching another student's enrollment (403)", async () => {
      prisma.enrollment.findUnique.mockResolvedValue({
        id: 'e2',
        studentId: OTHER_STUDENT_ID,
        courseId: COURSE.id,
        status: EnrollmentStatus.ENROLLED,
      });

      await expect(
        service.update(user(SubsystemRole.STUDENT), 'e2', { status: EnrollmentStatus.DROPPED }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('lets STAFF mark an enrollment COMPLETED', async () => {
      await expect(
        service.update(user(SubsystemRole.STAFF, 'user-003'), 'e1', {
          status: EnrollmentStatus.COMPLETED,
        }),
      ).resolves.toMatchObject({ status: EnrollmentStatus.COMPLETED });
    });

    it('returns 404 for an unknown enrollment', async () => {
      prisma.enrollment.findUnique.mockResolvedValue(null);

      await expect(
        service.update(user(SubsystemRole.ADMIN, 'user-004'), 'missing', {
          status: EnrollmentStatus.DROPPED,
        }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('findAll', () => {
    it('forces a STUDENT query onto their own student id', async () => {
      await service.findAll(user(SubsystemRole.STUDENT), {
        studentId: OTHER_STUDENT_ID,
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as never);

      expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ studentId: OWN_STUDENT.id }) }),
      );
    });
  });
});
