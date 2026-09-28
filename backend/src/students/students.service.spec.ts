import { AuthEventsLogger } from '../auth/auth-events.logger';
import { CoreHubIdentity, SubsystemRole } from '../auth/core-hub-identity';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from './students.service';

const OWN_STUDENT = {
  id: '11111111-1111-4111-8111-111111111111',
  coreUserId: 'user-001',
  studentCode: 'CS67001',
  firstName: 'Somchai',
  lastName: 'Jaidee',
  email: 'cs67001@student.csmju.local',
  faculty: 'Science',
  major: 'Computer Science',
  year: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const OTHER_STUDENT = { ...OWN_STUDENT, id: '22222222-2222-4222-8222-222222222222', coreUserId: 'user-002', studentCode: 'CS67002' };

function user(role: SubsystemRole, id = 'user-001'): CoreHubIdentity {
  return { id, email: `${id}@core.local`, coreRole: role.toLowerCase(), subsystemRole: role };
}

describe('StudentsService - business & ownership rules (spec §23, §26)', () => {
  let prisma: {
    student: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: StudentsService;

  beforeEach(() => {
    prisma = {
      student: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...OWN_STUDENT, ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...OWN_STUDENT, ...data })),
      },
    };
    service = new StudentsService(prisma as unknown as PrismaService, new AuthEventsLogger());
  });

  describe('findOne', () => {
    it('lets a STUDENT read their own profile', async () => {
      prisma.student.findUnique.mockResolvedValue(OWN_STUDENT);

      await expect(service.findOne(user(SubsystemRole.STUDENT), OWN_STUDENT.id)).resolves.toEqual(
        OWN_STUDENT,
      );
    });

    it("denies a STUDENT reading another student's profile with 403", async () => {
      prisma.student.findUnique.mockResolvedValue(OTHER_STUDENT);

      await expect(
        service.findOne(user(SubsystemRole.STUDENT), OTHER_STUDENT.id),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('lets STAFF read any student', async () => {
      prisma.student.findUnique.mockResolvedValue(OTHER_STUDENT);

      await expect(
        service.findOne(user(SubsystemRole.STAFF, 'user-003'), OTHER_STUDENT.id),
      ).resolves.toEqual(OTHER_STUDENT);
    });

    it('returns 404 for a missing student', async () => {
      prisma.student.findUnique.mockResolvedValue(null);

      await expect(service.findOne(user(SubsystemRole.ADMIN), OWN_STUDENT.id)).rejects.toMatchObject(
        { status: 404 },
      );
    });
  });

  describe('findAll', () => {
    it('restricts a STUDENT listing to their own record', async () => {
      await service.findAll(user(SubsystemRole.STUDENT), { page: 1, limit: 20, skip: 0, take: 20 } as never);

      expect(prisma.student.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ coreUserId: 'user-001' }) }),
      );
    });

    it('does not restrict a STAFF listing', async () => {
      await service.findAll(user(SubsystemRole.STAFF, 'user-003'), {
        page: 1,
        limit: 20,
        skip: 0,
        take: 20,
      } as never);

      const where = prisma.student.findMany.mock.calls[0][0].where;
      expect(where.coreUserId).toBeUndefined();
    });
  });

  describe('create', () => {
    it('rejects a duplicate student code with 409', async () => {
      prisma.student.findUnique.mockResolvedValue(OWN_STUDENT);

      await expect(
        service.create(user(SubsystemRole.STAFF, 'user-003'), {
          studentCode: 'CS67001',
          firstName: 'A',
          lastName: 'B',
          email: 'a@b.local',
          faculty: 'Science',
          major: 'CS',
          year: 1,
        }),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('update', () => {
    it('lets a STUDENT update their own contact details', async () => {
      prisma.student.findUnique.mockResolvedValue(OWN_STUDENT);

      await expect(
        service.update(user(SubsystemRole.STUDENT), OWN_STUDENT.id, { firstName: 'Somsak' }),
      ).resolves.toMatchObject({ firstName: 'Somsak' });
    });

    it('stops a STUDENT from changing academic fields on their own record', async () => {
      prisma.student.findUnique.mockResolvedValue(OWN_STUDENT);

      await expect(
        service.update(user(SubsystemRole.STUDENT), OWN_STUDENT.id, { year: 4 }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("stops a STUDENT from updating another student's record", async () => {
      prisma.student.findUnique.mockResolvedValue(OTHER_STUDENT);

      await expect(
        service.update(user(SubsystemRole.STUDENT), OTHER_STUDENT.id, { firstName: 'Hacked' }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('lets STAFF update academic fields on any record', async () => {
      prisma.student.findUnique.mockResolvedValue(OTHER_STUDENT);

      await expect(
        service.update(user(SubsystemRole.STAFF, 'user-003'), OTHER_STUDENT.id, { year: 4 }),
      ).resolves.toBeDefined();
    });
  });
});
