import { Injectable } from '@nestjs/common';
import {
  AttendanceRecord,
  AttendanceSession,
  AttendanceSessionStatus,
  AttendanceStatus,
  Prisma,
} from '../../generated/prisma/client';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission, can } from '../auth/permissions';
import { ClassSectionsService, assertCanManageSection } from '../class-sections/class-sections.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AppException } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentCode, currentCode, generateCodeSecret } from './attendance-code';
import {
  AttendanceSessionView,
  NO_COUNTS,
  SessionCounts,
  toSessionView,
} from './attendance-session.view';
import { OpenAttendanceSessionDto } from './dto/open-attendance-session.dto';
import { QueryAttendanceSessionsDto } from './dto/query-attendance-sessions.dto';

const MANAGE_ANY = Permission.ATTENDANCE_SESSION_MANAGE_ANY;

@Injectable()
export class AttendanceSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sections: ClassSectionsService,
  ) {}

  /** Business rule: a class section has at most one OPEN session at a time. */
  async open(
    dto: OpenAttendanceSessionDto,
    user: CoreHubIdentity,
    now = new Date(),
  ): Promise<AttendanceSessionView & { code: CurrentCode }> {
    const section = await this.sections.findOne(dto.classSectionId);
    assertCanManageSection(section, user, MANAGE_ANY);

    const [alreadyOpen] = await this.prisma.attendanceSession.findMany({
      where: { classSectionId: section.id, status: AttendanceSessionStatus.OPEN },
      take: 1,
    });
    if (alreadyOpen) {
      throw AppException.conflict('กลุ่มเรียนนี้มีรอบเช็คชื่อที่เปิดอยู่แล้ว กรุณาปิดรอบเดิมก่อน', {
        attendanceSessionId: alreadyOpen.id,
      });
    }

    const session = await this.prisma.attendanceSession.create({
      data: {
        classSectionId: section.id,
        openedByCoreUserId: user.id,
        codeSecret: generateCodeSecret(),
        openedAt: now,
      },
    });

    return { ...toSessionView(session), code: currentCode(session.codeSecret, now) };
  }

  async findAll(
    query: QueryAttendanceSessionsDto,
    user: CoreHubIdentity,
  ): Promise<{ items: AttendanceSessionView[]; total: number }> {
    const where: Prisma.AttendanceSessionWhereInput = {
      classSectionId: query.classSectionId,
      status: query.status,
    };

    // Without the ANY permission, only sessions of the caller's own sections.
    if (!can(user.subsystemRole, MANAGE_ANY)) {
      const owned = await this.prisma.classSection.findMany({
        where: { ownerCoreUserId: user.id },
      });
      const ownedIds = owned.map((section) => section.id);
      where.classSectionId = query.classSectionId
        ? ownedIds.includes(query.classSectionId)
          ? query.classSectionId
          : { in: [] }
        : { in: ownedIds };
    }

    const [items, total] = await Promise.all([
      this.prisma.attendanceSession.findMany({
        where,
        orderBy: { openedAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.attendanceSession.count({ where }),
    ]);

    const counts = await this.countsFor(items.map((session) => session.id));
    return {
      items: items.map((session) => toSessionView(session, counts.get(session.id))),
      total,
    };
  }

  async findOne(id: string, user: CoreHubIdentity): Promise<AttendanceSessionView> {
    const session = await this.findManaged(id, user);
    const counts = await this.countsFor([session.id]);
    return toSessionView(session, counts.get(session.id));
  }

  /** The code the staff member shows in class. Only an OPEN session has one. */
  async getCode(id: string, user: CoreHubIdentity, now = new Date()): Promise<CurrentCode> {
    const session = await this.findManaged(id, user);
    if (session.status !== AttendanceSessionStatus.OPEN) {
      throw AppException.conflict('รอบเช็คชื่อนี้ปิดแล้ว');
    }
    return currentCode(session.codeSecret, now);
  }

  async close(id: string, user: CoreHubIdentity, now = new Date()): Promise<AttendanceSessionView> {
    const session = await this.findManaged(id, user);
    if (session.status !== AttendanceSessionStatus.OPEN) {
      throw AppException.conflict('รอบเช็คชื่อนี้ปิดแล้ว');
    }

    const closed = await this.prisma.attendanceSession.update({
      where: { id },
      data: { status: AttendanceSessionStatus.CLOSED, closedAt: now },
    });
    const counts = await this.countsFor([closed.id]);
    return toSessionView(closed, counts.get(closed.id));
  }

  async findRecords(
    id: string,
    query: PaginationQueryDto,
    user: CoreHubIdentity,
  ): Promise<{ items: AttendanceRecord[]; total: number }> {
    await this.findManaged(id, user);

    const where: Prisma.AttendanceRecordWhereInput = { attendanceSessionId: id };
    const [items, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        orderBy: { checkedInAt: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    return { items, total };
  }

  /** Check-ins and late check-ins per session, in one grouped query. */
  private async countsFor(sessionIds: string[]): Promise<Map<string, SessionCounts>> {
    const counts = new Map<string, SessionCounts>();
    if (sessionIds.length === 0) {
      return counts;
    }

    const groups = await this.prisma.attendanceRecord.groupBy({
      by: ['attendanceSessionId', 'status'],
      where: { attendanceSessionId: { in: sessionIds } },
      _count: { _all: true },
    });

    for (const group of groups) {
      const current = counts.get(group.attendanceSessionId) ?? { ...NO_COUNTS };
      current.recordCount += group._count._all;
      if (group.status === AttendanceStatus.LATE) {
        current.lateCount += group._count._all;
      }
      counts.set(group.attendanceSessionId, current);
    }
    return counts;
  }

  private async findManaged(id: string, user: CoreHubIdentity): Promise<AttendanceSession> {
    const session = await this.prisma.attendanceSession.findUnique({ where: { id } });
    if (!session) {
      throw AppException.notFound('ไม่พบรอบเช็คชื่อนี้');
    }
    const section = await this.sections.findOne(session.classSectionId);
    assertCanManageSection(section, user, MANAGE_ANY);
    return session;
  }
}
