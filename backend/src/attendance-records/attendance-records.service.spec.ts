import { AttendanceSessionStatus, AttendanceStatus } from '../../generated/prisma/client';
import { currentCode } from '../attendance-sessions/attendance-code';
import { CoreHubIdentity, SubsystemRole } from '../auth/core-hub-identity';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceRecordsService } from './attendance-records.service';
import { MAX_FAILED_ATTEMPTS } from './check-in-attempts';

const OPENED_AT = new Date(Date.UTC(2026, 8, 29, 2, 0, 0));
const ROOM = { latitude: 18.8925, longitude: 99.0142 };

const SECTION = {
  id: '11111111-1111-4111-8111-111111111111',
  courseCode: 'CS201',
  courseName: 'Data Structures',
  sectionCode: '1',
  academicYear: 2026,
  term: 1,
  ...ROOM,
  radiusMeters: 50,
  lateAfterMinutes: 15,
  ownerCoreUserId: 'user-003',
  createdAt: OPENED_AT,
  updatedAt: OPENED_AT,
};

const SESSION = {
  id: '22222222-2222-4222-8222-222222222222',
  classSectionId: SECTION.id,
  openedByCoreUserId: 'user-003',
  status: AttendanceSessionStatus.OPEN,
  codeSecret: 'b'.repeat(64),
  openedAt: OPENED_AT,
  closedAt: null,
  createdAt: OPENED_AT,
  updatedAt: OPENED_AT,
};

const STUDENT: CoreHubIdentity = {
  id: 'user-002',
  email: 'student@core.local',
  coreRole: 'student',
  subsystemRole: SubsystemRole.STUDENT,
};

const minutesAfterOpen = (minutes: number) => new Date(OPENED_AT.getTime() + minutes * 60_000);
const codeAt = (now: Date) => currentCode(SESSION.codeSecret, now).code;

describe('AttendanceRecordsService.checkIn - business rules', () => {
  let prisma: {
    attendanceSession: { findMany: jest.Mock };
    classSection: { findUnique: jest.Mock };
    attendanceRecord: { groupBy: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
  };
  let service: AttendanceRecordsService;

  beforeEach(() => {
    prisma = {
      attendanceSession: { findMany: jest.fn().mockResolvedValue([SESSION]) },
      classSection: { findUnique: jest.fn().mockResolvedValue(SECTION) },
      attendanceRecord: {
        groupBy: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'rec-1', ...data })),
      },
    };
    service = new AttendanceRecordsService(prisma as unknown as PrismaService);
  });

  it('records PRESENT inside the radius and before the late threshold', async () => {
    const now = minutesAfterOpen(5);

    const record = await service.checkIn({ code: codeAt(now), ...ROOM }, STUDENT, now);

    expect(record).toMatchObject({
      attendanceSessionId: SESSION.id,
      coreUserId: STUDENT.id,
      email: STUDENT.email,
      status: AttendanceStatus.PRESENT,
      distanceMeters: 0,
      classSection: { courseCode: 'CS201', sectionCode: '1' },
    });
    expect(prisma.attendanceSession.findMany).toHaveBeenCalledWith({
      where: { status: AttendanceSessionStatus.OPEN },
    });
  });

  it('records LATE after the late threshold', async () => {
    const now = minutesAfterOpen(16);
    const record = await service.checkIn({ code: codeAt(now), ...ROOM }, STUDENT, now);
    expect(record.status).toBe(AttendanceStatus.LATE);
  });

  it('rejects a wrong code with 400', async () => {
    const now = minutesAfterOpen(1);
    await expect(
      service.checkIn({ code: '000000' === codeAt(now) ? '111111' : '000000', ...ROOM }, STUDENT, now),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.attendanceRecord.create).not.toHaveBeenCalled();
  });

  it('locks the student out after too many wrong codes, even with the right code', async () => {
    const now = minutesAfterOpen(1);
    const wrong = codeAt(now) === '000000' ? '111111' : '000000';

    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
      await expect(service.checkIn({ code: wrong, ...ROOM }, STUDENT, now)).rejects.toMatchObject({
        status: 400,
      });
    }

    await expect(
      service.checkIn({ code: codeAt(now), ...ROOM }, STUDENT, now),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects a student outside the radius with 409 and the distance', async () => {
    const now = minutesAfterOpen(1);
    const farAway = { latitude: ROOM.latitude + 0.001, longitude: ROOM.longitude };

    await expect(
      service.checkIn({ code: codeAt(now), ...farAway }, STUDENT, now),
    ).rejects.toMatchObject({
      status: 409,
      details: { distanceMeters: 111, radiusMeters: 50 },
    });
  });

  it('rejects an imprecise location fix with 400', async () => {
    const now = minutesAfterOpen(1);
    await expect(
      service.checkIn({ code: codeAt(now), ...ROOM, accuracyMeters: 500 }, STUDENT, now),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a second check-in to the same session with 409', async () => {
    const now = minutesAfterOpen(1);
    prisma.attendanceRecord.findUnique.mockResolvedValue({ id: 'rec-0' });

    await expect(
      service.checkIn({ code: codeAt(now), ...ROOM }, STUDENT, now),
    ).rejects.toMatchObject({ status: 409 });
    expect(prisma.attendanceRecord.create).not.toHaveBeenCalled();
  });

  it('finds no session when none is open', async () => {
    const now = minutesAfterOpen(1);
    prisma.attendanceSession.findMany.mockResolvedValue([]);

    await expect(
      service.checkIn({ code: codeAt(now), ...ROOM }, STUDENT, now),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('summarises the own check-ins of the student by status', async () => {
    prisma.attendanceRecord.groupBy.mockResolvedValue([
      { status: 'PRESENT', _count: { _all: 7 } },
      { status: 'LATE', _count: { _all: 2 } },
    ]);

    await expect(service.summaryMine(STUDENT)).resolves.toEqual({ total: 9, present: 7, late: 2 });
    expect(prisma.attendanceRecord.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { coreUserId: STUDENT.id } }),
    );
  });

  it('summarises a student with no check-ins as zeros', async () => {
    await expect(service.summaryMine(STUDENT)).resolves.toEqual({ total: 0, present: 0, late: 0 });
  });
});
