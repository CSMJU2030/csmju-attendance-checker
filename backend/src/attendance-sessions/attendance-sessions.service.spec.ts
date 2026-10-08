import { AttendanceSessionStatus } from '../../generated/prisma/client';
import { CoreHubIdentity, SubsystemRole } from '../auth/core-hub-identity';
import { ClassSectionsService } from '../class-sections/class-sections.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceSessionsService } from './attendance-sessions.service';
import { QueryAttendanceSessionsDto } from './dto/query-attendance-sessions.dto';

const NOW = new Date(Date.UTC(2026, 8, 29, 2, 0, 0));

const SECTION = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerCoreUserId: 'user-003',
};

const SESSION = {
  id: '22222222-2222-4222-8222-222222222222',
  classSectionId: SECTION.id,
  openedByCoreUserId: 'user-003',
  status: AttendanceSessionStatus.OPEN,
  codeSecret: 'c'.repeat(64),
  openedAt: NOW,
  closedAt: null,
  latitude: null,
  longitude: null,
};

const identity = (id: string, role: SubsystemRole): CoreHubIdentity => ({
  id,
  email: `${id}@core.local`,
  coreRole: role.toLowerCase(),
  subsystemRole: role,
});

const OWNER = identity('user-003', SubsystemRole.STAFF);
const OTHER_STAFF = identity('user-009', SubsystemRole.STAFF);
const ADMIN = identity('user-001', SubsystemRole.ADMIN);

describe('AttendanceSessionsService - business rules', () => {
  let prisma: {
    attendanceSession: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    classSection: { findMany: jest.Mock };
    attendanceRecord: { groupBy: jest.Mock };
  };
  let sections: { findOne: jest.Mock };
  let service: AttendanceSessionsService;

  beforeEach(() => {
    prisma = {
      attendanceSession: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(SESSION),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ ...SESSION, ...data, id: 'new-session', closedAt: null }),
        ),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...SESSION, ...data })),
        count: jest.fn().mockResolvedValue(0),
      },
      classSection: { findMany: jest.fn().mockResolvedValue([SECTION]) },
      attendanceRecord: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    sections = { findOne: jest.fn().mockResolvedValue(SECTION) };
    service = new AttendanceSessionsService(
      prisma as unknown as PrismaService,
      sections as unknown as ClassSectionsService,
    );
  });

  it('opens a session for the section owner and returns the first code', async () => {
    const opened = await service.open({ classSectionId: SECTION.id }, OWNER, NOW);

    expect(opened).toMatchObject({ id: 'new-session', status: 'OPEN', classSectionId: SECTION.id });
    expect(opened.code.code).toMatch(/^\d{6}$/);
    expect(opened).not.toHaveProperty('codeSecret');
  });

  it("keeps the lecturer's location as the session's point", async () => {
    const opened = await service.open(
      { classSectionId: SECTION.id, latitude: 18.8925, longitude: 99.0142, accuracyMeters: 12 },
      OWNER,
      NOW,
    );

    expect(opened).toMatchObject({ latitude: 18.8925, longitude: 99.0142 });
    expect(prisma.attendanceSession.create.mock.calls[0][0].data).not.toHaveProperty('accuracyMeters');
  });

  it('opens without a location and falls back to the section point', async () => {
    const opened = await service.open({ classSectionId: SECTION.id }, OWNER, NOW);
    expect(opened).toMatchObject({ latitude: null, longitude: null });
  });

  it('refuses an imprecise lecturer location with 400 and opens nothing', async () => {
    await expect(
      service.open(
        { classSectionId: SECTION.id, latitude: 18.8925, longitude: 99.0142, accuracyMeters: 1500 },
        OWNER,
        NOW,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.attendanceSession.create).not.toHaveBeenCalled();
  });

  it('refuses a second OPEN session for the same section with 409', async () => {
    prisma.attendanceSession.findMany.mockResolvedValue([SESSION]);
    await expect(service.open({ classSectionId: SECTION.id }, OWNER, NOW)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('refuses staff who do not own the section with 403', async () => {
    await expect(
      service.open({ classSectionId: SECTION.id }, OTHER_STAFF, NOW),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.getCode(SESSION.id, OTHER_STAFF, NOW)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('lets ADMIN manage any section', async () => {
    await expect(service.getCode(SESSION.id, ADMIN, NOW)).resolves.toMatchObject({
      stepSeconds: 120,
    });
  });

  it('closes an OPEN session and refuses to close it twice', async () => {
    const closed = await service.close(SESSION.id, OWNER, NOW);
    expect(closed).toMatchObject({ status: 'CLOSED', closedAt: NOW });

    prisma.attendanceSession.findUnique.mockResolvedValue({
      ...SESSION,
      status: AttendanceSessionStatus.CLOSED,
    });
    await expect(service.close(SESSION.id, OWNER, NOW)).rejects.toMatchObject({ status: 409 });
    await expect(service.getCode(SESSION.id, OWNER, NOW)).rejects.toMatchObject({ status: 409 });
  });

  it('reports how many students checked in', async () => {
    prisma.attendanceRecord.groupBy.mockResolvedValue([
      { attendanceSessionId: SESSION.id, _count: { _all: 13 } },
    ]);

    const session = await service.findOne(SESSION.id, OWNER);
    expect(session).toMatchObject({ recordCount: 13 });
    expect(session).not.toHaveProperty('lateCount');
    expect(prisma.attendanceRecord.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { attendanceSessionId: { in: [SESSION.id] } } }),
    );
  });

  it('counts each listed session separately, with zero for sessions nobody joined', async () => {
    const other = { ...SESSION, id: '33333333-3333-4333-8333-333333333333' };
    prisma.attendanceSession.findMany.mockResolvedValue([SESSION, other]);
    prisma.attendanceSession.count.mockResolvedValue(2);
    prisma.attendanceRecord.groupBy.mockResolvedValue([
      { attendanceSessionId: SESSION.id, _count: { _all: 4 } },
    ]);

    const { items } = await service.findAll(
      Object.assign(new QueryAttendanceSessionsDto(), { classSectionId: SECTION.id }),
      OWNER,
    );
    expect(items.map((item) => item.recordCount)).toEqual([4, 0]);
  });

  it('returns 404 for an unknown session', async () => {
    prisma.attendanceSession.findUnique.mockResolvedValue(null);
    await expect(service.findOne(SESSION.id, OWNER)).rejects.toMatchObject({ status: 404 });
  });

  it('limits staff listings to their own sections', async () => {
    await service.findAll({ skip: 0, take: 20 } as never, OWNER);

    expect(prisma.classSection.findMany).toHaveBeenCalledWith({
      where: { ownerCoreUserId: OWNER.id },
    });
    expect(prisma.attendanceSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { classSectionId: { in: [SECTION.id] }, status: undefined },
      }),
    );
  });
});
