import { CoreHubIdentity, SubsystemRole } from '../auth/core-hub-identity';
import { PrismaService } from '../prisma/prisma.service';
import { ClassSectionsService } from './class-sections.service';

const SECTION = {
  id: '11111111-1111-4111-8111-111111111111',
  courseCode: 'CS201',
  courseName: 'Data Structures',
  sectionCode: '1',
  academicYear: 2026,
  term: 1,
  latitude: 18.8925,
  longitude: 99.0142,
  radiusMeters: 50,
  ownerCoreUserId: 'user-003',
};

const STAFF: CoreHubIdentity = {
  id: 'user-003',
  email: 'staff@core.local',
  coreRole: 'staff',
  subsystemRole: SubsystemRole.STAFF,
};

const OTHER_STAFF: CoreHubIdentity = { ...STAFF, id: 'user-009' };

const CREATE = {
  courseCode: 'CS305',
  courseName: 'Software Engineering',
  sectionCode: '1',
  academicYear: 2026,
  term: 1,
  latitude: 18.8925,
  longitude: 99.0142,
};

describe('ClassSectionsService - business rules', () => {
  let prisma: {
    classSection: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    attendanceSession: { count: jest.Mock };
  };
  let service: ClassSectionsService;

  beforeEach(() => {
    prisma = {
      classSection: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...SECTION, ...data })),
        delete: jest.fn().mockResolvedValue(SECTION),
      },
      attendanceSession: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new ClassSectionsService(prisma as unknown as PrismaService);
  });

  it('makes the caller the owner of a new section', async () => {
    await expect(service.create(CREATE, STAFF)).resolves.toMatchObject({
      courseCode: 'CS305',
      ownerCoreUserId: STAFF.id,
    });
  });

  it('refuses a duplicate course, section, year and term with 409', async () => {
    prisma.classSection.findUnique.mockResolvedValue(SECTION);
    await expect(service.create(CREATE, STAFF)).rejects.toMatchObject({ status: 409 });
  });

  it('lets only the owner update a section', async () => {
    prisma.classSection.findUnique.mockResolvedValue(SECTION);

    await expect(service.update(SECTION.id, { radiusMeters: 80 }, STAFF)).resolves.toMatchObject({
      radiusMeters: 80,
    });
    await expect(
      service.update(SECTION.id, { radiusMeters: 80 }, OTHER_STAFF),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns 404 for an unknown section', async () => {
    await expect(service.findOne(SECTION.id)).rejects.toMatchObject({ status: 404 });
  });

  it('lets the owner delete a section without attendance history', async () => {
    prisma.classSection.findUnique.mockResolvedValue(SECTION);

    await expect(service.remove(SECTION.id, STAFF)).resolves.toEqual({
      id: SECTION.id,
      deleted: true,
    });
    expect(prisma.classSection.delete).toHaveBeenCalledWith({ where: { id: SECTION.id } });
  });

  it('refuses to delete a section owned by other staff with 403', async () => {
    prisma.classSection.findUnique.mockResolvedValue(SECTION);

    await expect(service.remove(SECTION.id, OTHER_STAFF)).rejects.toMatchObject({ status: 403 });
    expect(prisma.classSection.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete a section that has attendance sessions with 409', async () => {
    prisma.classSection.findUnique.mockResolvedValue(SECTION);
    prisma.attendanceSession.count.mockResolvedValue(2);

    await expect(service.remove(SECTION.id, STAFF)).rejects.toMatchObject({ status: 409 });
    expect(prisma.classSection.delete).not.toHaveBeenCalled();
  });
});
