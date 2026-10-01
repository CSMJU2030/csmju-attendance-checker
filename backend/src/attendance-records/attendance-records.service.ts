import { Injectable } from '@nestjs/common';
import {
  AttendanceRecord,
  AttendanceSessionStatus,
  AttendanceStatus,
  ClassSection,
} from '../../generated/prisma/client';
import { isValidCode } from '../attendance-sessions/attendance-code';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { PeopleService } from '../core-hub/people.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AppException } from '../common/errors';
import { distanceInMeters } from '../common/geo';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInAttempts } from './check-in-attempts';
import { CheckInDto } from './dto/check-in.dto';

/** A location fix less precise than this cannot prove the student is in class. */
export const MAX_ACCURACY_METERS = 100;

type SectionSummary = Pick<
  ClassSection,
  'courseCode' | 'courseName' | 'sectionCode' | 'academicYear' | 'term'
>;

export type AttendanceRecordView = AttendanceRecord & { classSection: SectionSummary | null };

export interface AttendanceSummary {
  total: number;
  present: number;
  late: number;
}

function summarize(section: ClassSection): SectionSummary {
  return {
    courseCode: section.courseCode,
    courseName: section.courseName,
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

    const distance = Math.round(distanceInMeters(dto, section));
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

    const lateAfterMs = section.lateAfterMinutes * 60 * 1000;
    const status =
      now.getTime() - session.openedAt.getTime() > lateAfterMs
        ? AttendanceStatus.LATE
        : AttendanceStatus.PRESENT;

    const personCode = await this.people.myPersonCode(token);

    const record = await this.prisma.attendanceRecord.create({
      data: {
        attendanceSessionId: session.id,
        coreUserId: user.id,
        personCode,
        status,
        checkedInAt: now,
        distanceMeters: distance,
      },
    });

    return { ...record, classSection: summarize(section) };
  }

  async findMine(
    query: PaginationQueryDto,
    user: CoreHubIdentity,
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

    const items = records.map((record) => {
      const section = sectionBySession.get(record.attendanceSessionId);
      return { ...record, classSection: section ? summarize(section) : null };
    });

    return { items, total };
  }

  /** How many times the student checked in, on time and late. */
  async summaryMine(user: CoreHubIdentity): Promise<AttendanceSummary> {
    const groups = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { coreUserId: user.id },
      _count: { _all: true },
    });

    const count = (status: AttendanceStatus) =>
      groups.find((group) => group.status === status)?._count._all ?? 0;
    const present = count(AttendanceStatus.PRESENT);
    const late = count(AttendanceStatus.LATE);
    return { total: present + late, present, late };
  }
}
