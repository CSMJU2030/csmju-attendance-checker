import { AttendanceSessionStatus } from '../../generated/prisma/client';
import { CoreHubIdentity, SubsystemRole } from '../auth/core-hub-identity';
import { ClassSectionsService } from '../class-sections/class-sections.service';
import { PrismaService } from '../prisma/prisma.service';
import { AT_RISK_ABSENCE_RATE, AttendanceStatsService } from './attendance-stats.service';

const AT = new Date(Date.UTC(2026, 8, 1));
const SECTION = {
  id: '11111111-1111-4111-8111-111111111111',
  courseCode: '10301111-1',
  courseName: null,
  sectionCode: '1',
  academicYear: 2026,
  term: 1,
  latitude: 18.8925,
  longitude: 99.0142,
  radiusMeters: 50,
  ownerCoreUserId: 'user-003',
  createdAt: AT,
  updatedAt: AT,
};
const OWNER: CoreHubIdentity = { id: 'user-003', email: 'staff@core.local', coreRole: 'staff', subsystemRole: SubsystemRole.STAFF };
const OTHER: CoreHubIdentity = { ...OWNER, id: 'user-009' };
const ADMIN: CoreHubIdentity = { ...OWNER, id: 'user-004', subsystemRole: SubsystemRole.ADMIN };

const sessions = ['s1', 's2', 's3', 's4'].map((id) => ({ id, status: AttendanceSessionStatus.CLOSED }));
const record = (session: string, personCode: string | null) => ({ attendanceSessionId: session, personCode });

describe('AttendanceStatsService', () => {
  let prisma: {
    classSection: { findMany: jest.Mock; count: jest.Mock };
    attendanceSession: { findMany: jest.Mock };
    attendanceRecord: { findMany: jest.Mock };
    classSectionStudent: { findMany: jest.Mock };
  };
  let service: AttendanceStatsService;

  beforeEach(() => {
    prisma = {
      classSection: { findMany: jest.fn().mockResolvedValue([SECTION]), count: jest.fn().mockResolvedValue(1) },
      attendanceSession: { findMany: jest.fn().mockResolvedValue(sessions) },
      attendanceRecord: {
        findMany: jest.fn().mockResolvedValue([
          // A came to all 4, B to 2, C to 3; D is not on the roster; one account has no id.
          ...['s1', 's2', 's3', 's4'].map((s) => record(s, 'A')),
          record('s1', 'B'),
          record('s2', 'B'),
          record('s1', 'C'),
          record('s2', 'C'),
          record('s3', 'C'),
          record('s4', 'D'),
          record('s4', null),
        ]),
      },
      classSectionStudent: {
        findMany: jest.fn().mockResolvedValue(['A', 'B', 'C', 'E'].map((personCode) => ({ personCode }))),
      },
    };
    const sections = {
      findOne: jest.fn().mockResolvedValue(SECTION),
      views: jest.fn().mockImplementation(async (rows: unknown[]) =>
        rows.map(() => ({ courseName: 'การเขียนโปรแกรมคอมพิวเตอร์' })),
      ),
    };
    service = new AttendanceStatsService(
      prisma as unknown as PrismaService,
      sections as unknown as ClassSectionsService,
    );
  });

  it('marks a student at risk from 30% absences, roster students who never came included', async () => {
    expect(AT_RISK_ABSENCE_RATE).toBe(0.3);
    const detail = await service.section(SECTION.id, OWNER, 'token');

    expect(detail.students).toEqual([
      { personCode: 'E', attended: 0, absent: 4, absenceRate: 1, atRisk: true },
      { personCode: 'B', attended: 2, absent: 2, absenceRate: 0.5, atRisk: true },
      { personCode: 'C', attended: 3, absent: 1, absenceRate: 0.25, atRisk: false },
      { personCode: 'A', attended: 4, absent: 0, absenceRate: 0, atRisk: false },
    ]);
    expect(detail).toMatchObject({
      courseName: 'การเขียนโปรแกรมคอมพิวเตอร์',
      closedSessions: 4,
      studentSource: 'ROSTER',
      studentCount: 4,
      attendanceRate: 9 / 16,
      atRiskCount: 2,
      offRosterCount: 1,
    });
    expect(prisma.attendanceSession.findMany).toHaveBeenCalledWith({
      where: { classSectionId: SECTION.id, status: AttendanceSessionStatus.CLOSED },
    });
  });

  it('falls back to students who checked in while the section has no roster', async () => {
    prisma.classSectionStudent.findMany.mockResolvedValue([]);
    const detail = await service.section(SECTION.id, OWNER, 'token');
    expect(detail.studentSource).toBe('CHECKED_IN');
    expect(detail.students.map((student) => student.personCode)).toEqual(['D', 'B', 'C', 'A']);
    expect(detail.offRosterCount).toBe(0);
  });

  it('has no rate and nobody at risk before the first closed session', async () => {
    prisma.attendanceSession.findMany.mockResolvedValue([]);
    prisma.attendanceRecord.findMany.mockResolvedValue([]);
    const detail = await service.section(SECTION.id, OWNER, 'token');
    expect(detail).toMatchObject({ closedSessions: 0, attendanceRate: null, atRiskCount: 0 });
    expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled();
  });

  it('refuses another lecturer and lets ADMIN in', async () => {
    await expect(service.section(SECTION.id, OTHER, 'token')).rejects.toMatchObject({ status: 403 });
    await expect(service.section(SECTION.id, ADMIN, 'token')).resolves.toMatchObject({ atRiskCount: 2 });
  });

  it('limits lists and totals to the caller own sections unless ADMIN', async () => {
    await service.sectionPage(OWNER, { skip: 0, take: 20 }, 'token');
    expect(prisma.classSection.findMany.mock.calls[0][0].where).toEqual({ ownerCoreUserId: OWNER.id });

    const summary = await service.summary(ADMIN);
    expect(prisma.classSection.findMany.mock.calls[1][0].where).toEqual({});
    expect(summary).toEqual({ sections: 1, closedSessions: 4, students: 4, attendanceRate: 9 / 16, atRiskStudents: 2 });
  });
});
