import { Injectable } from '@nestjs/common';
import {
  AttendanceRecord,
  AttendanceSessionStatus,
  ClassSection,
  Prisma,
} from '../../generated/prisma/client';
import { isValidCode } from '../attendance-sessions/attendance-code';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission } from '../auth/permissions';
import { assertCanManageSection } from '../class-sections/class-sections.service';
import { rosterMembership } from '../class-sections/roster';
import { CourseCatalog, CourseName } from '../core-hub/course-catalog.service';
import { PeopleService } from '../core-hub/people.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AppException } from '../common/errors';
import { distanceInMeters, MAX_ACCURACY_METERS } from '../common/geo';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInAttempts } from './check-in-attempts';
import { CheckInDto } from './dto/check-in.dto';
import { QueryAttendanceRecordsDto } from './dto/query-attendance-records.dto';

type SectionSummary = Pick<
  ClassSection,
  'courseCode' | 'courseName' | 'sectionCode' | 'academicYear' | 'term'
>;

export type AttendanceRecordView = AttendanceRecord & { classSection: SectionSummary | null };

export type StaffAttendanceRecord = AttendanceRecord & { inRoster: boolean | null };

export interface AttendanceSummary {
  /** Sessions the student checked in to. */
  total: number;
}

function summarize(section: ClassSection, names: Map<string, CourseName>): SectionSummary {
  return {
    courseCode: section.courseCode,
    courseName: names.get(section.courseCode)?.nameTh ?? section.courseName ?? section.courseCode,
    sectionCode: section.sectionCode,
    academicYear: section.academicYear,
    term: section.term,
  };
}

@Injectable()
export class AttendanceRecordsService {
  private readonly attempts = new CheckInAttempts();

  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly courses: CourseCatalog,
  ) {}

  /**
   * The code decides which open session the student joins, so the student
   * types only the 6 digits shown in class.
   *
   * `token` is the student's own Core Hub token. It is used once, after every
   * rule has passed, to read the student id from GET /people/me - the record
   * keeps that id, never a name or an e-mail address (reference-data.md 8).
   */
  async checkIn(
    dto: CheckInDto,
    user: CoreHubIdentity,
    token: string,
    now = new Date(),
  ): Promise<AttendanceRecordView> {
    const lockedMs = this.attempts.lockedOutFor(user.id, now);
    if (lockedMs > 0) {
      const retryAfterSeconds = Math.ceil(lockedMs / 1000);
      throw AppException.conflict(
        `กรอกรหัสผิดหลายครั้งเกินไป กรุณารอ ${Math.ceil(retryAfterSeconds / 60)} นาทีแล้วลองใหม่`,
        { retryAfterSeconds },
      );
    }

    if (dto.accuracyMeters !== undefined && dto.accuracyMeters > MAX_ACCURACY_METERS) {
      throw AppException.badRequest(
        `ตำแหน่งจากอุปกรณ์ไม่แม่นยำพอ (คลาดเคลื่อน ${Math.round(dto.accuracyMeters)} เมตร) กรุณาเปิด GPS แล้วลองใหม่`,
      );
    }

    const openSessions = await this.prisma.attendanceSession.findMany({
      where: { status: AttendanceSessionStatus.OPEN },
    });
    const matched = openSessions.filter((session) =>
      isValidCode(session.codeSecret, dto.code, now),
    );

    if (matched.length !== 1) {
      this.attempts.recordFailure(user.id, now);
      throw AppException.badRequest('รหัสเช็คชื่อไม่ถูกต้อง หรือรหัสถูกเปลี่ยนใหม่แล้ว');
    }
    this.attempts.clear(user.id);

    const [session] = matched;
    const section = await this.prisma.classSection.findUnique({
      where: { id: session.classSectionId },
    });
    if (!section) {
      throw AppException.notFound('ไม่พบกลุ่มเรียนของรอบเช็คชื่อนี้');
    }

    // The point the lecturer stood on when opening the session, or the
    // section's saved point when the session was opened without one.
    const center =
      session.latitude !== null && session.longitude !== null
        ? { latitude: session.latitude, longitude: session.longitude }
        : section;
    const distance = Math.round(distanceInMeters(dto, center));
    if (distance > section.radiusMeters) {
      throw AppException.conflict(
        `คุณอยู่นอกพื้นที่เช็คชื่อ (ห่าง ${distance} เมตร เกินรัศมี ${section.radiusMeters} เมตร) กรุณาเข้าไปในห้องเรียนแล้วลองอีกครั้ง`,
        { distanceMeters: distance, radiusMeters: section.radiusMeters },
      );
    }

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: {
        attendanceSessionId_coreUserId: { attendanceSessionId: session.id, coreUserId: user.id },
      },
    });
    if (existing) {
      throw AppException.conflict('คุณเช็คชื่อในรอบนี้แล้ว');
    }

    const personCode = await this.people.myPersonCode(token);

    const record = await this.prisma.attendanceRecord.create({
      data: {
        attendanceSessionId: session.id,
        coreUserId: user.id,
        personCode,
        checkedInAt: now,
        distanceMeters: distance,
      },
    });

    const names = await this.courses.names([section.courseCode], token);
    return { ...record, classSection: summarize(section, names) };
  }

  async findMine(
    query: PaginationQueryDto,
    user: CoreHubIdentity,
    token: string,
  ): Promise<{ items: AttendanceRecordView[]; total: number }> {
    const where = { coreUserId: user.id };
    const [records, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        orderBy: { checkedInAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: { id: { in: records.map((record) => record.attendanceSessionId) } },
    });
    const sections = await this.prisma.classSection.findMany({
      where: { id: { in: sessions.map((session) => session.classSectionId) } },
    });

    const sectionBySession = new Map(
      sessions.map((session) => [
        session.id,
        sections.find((section) => section.id === session.classSectionId),
      ]),
    );

    const names = await this.courses.names(
      sections.map((section) => section.courseCode),
      token,
    );
    const items = records.map((record) => {
      const section = sectionBySession.get(record.attendanceSessionId);
      return { ...record, classSection: section ? summarize(section, names) : null };
    });

    return { items, total };
  }

  /**
   * Check-ins of one class section for its staff, newest first, optionally
   * narrowed to a student id prefix and a time range.
   */
  async findForSection(
    query: QueryAttendanceRecordsDto,
    user: CoreHubIdentity,
  ): Promise<{ items: StaffAttendanceRecord[]; total: number }> {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from >= to) {
      throw AppException.badRequest('วันที่เริ่มต้นต้องมาก่อนวันที่สิ้นสุด');
    }

    const section = await this.prisma.classSection.findUnique({
      where: { id: query.classSectionId },
    });
    if (!section) {
      throw AppException.notFound('ไม่พบกลุ่มเรียนนี้');
    }
    assertCanManageSection(section, user, Permission.ATTENDANCE_SESSION_MANAGE_ANY);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: { classSectionId: section.id },
    });
    const where: Prisma.AttendanceRecordWhereInput = {
      attendanceSessionId: { in: sessions.map((session) => session.id) },
      personCode: query.personCode ? { startsWith: query.personCode } : undefined,
      checkedInAt: from || to ? { gte: from, lt: to } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        orderBy: [{ checkedInAt: 'desc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);
    const inRoster = await rosterMembership(
      this.prisma,
      section.id,
      items.map((item) => item.personCode),
    );
    return { items: items.map((item) => ({ ...item, inRoster: inRoster(item.personCode) })), total };
  }

  /** How many sessions the student checked in to. */
  async summaryMine(user: CoreHubIdentity): Promise<AttendanceSummary> {
    const total = await this.prisma.attendanceRecord.count({ where: { coreUserId: user.id } });
    return { total };
  }
}
