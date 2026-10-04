import { Injectable } from '@nestjs/common';
import { AttendanceSessionStatus, ClassSection, Prisma } from '../../generated/prisma/client';
import { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission, can } from '../auth/permissions';
import { ClassSectionsService, assertCanManageSection } from '../class-sections/class-sections.service';
import { PrismaService } from '../prisma/prisma.service';

/** A student whose absences reach this share of the closed sessions is at risk. */
export const AT_RISK_ABSENCE_RATE = 0.3;

const MANAGE_ANY = Permission.ATTENDANCE_SESSION_MANAGE_ANY;

/**
 * Who the numbers are about: the section's roster, or - while a section has
 * no roster yet - everyone who checked in at least once (students who never
 * came cannot be counted then).
 */
export type StudentSource = 'ROSTER' | 'CHECKED_IN';

export interface StudentStat {
  personCode: string;
  attended: number;
  absent: number;
  /** 0-1 share of the closed sessions the student missed. */
  absenceRate: number;
  atRisk: boolean;
}

export interface SectionStat {
  classSectionId: string;
  courseCode: string;
  courseName: string;
  sectionCode: string;
  academicYear: number;
  term: number;
  /** Only closed sessions count: an open one may still be taking check-ins. */
  closedSessions: number;
  studentSource: StudentSource;
  studentCount: number;
  /** 0-1 share of expected check-ins that happened; null before the first closed session. */
  attendanceRate: number | null;
  atRiskCount: number;
  /** Students who checked in but are not on the roster (0 while there is no roster). */
  offRosterCount: number;
}

/** One at-risk student in one section - for the export and the dashboard alert. */
export interface AtRiskEntry extends StudentStat {
  classSectionId: string;
  courseCode: string;
  courseName: string;
  sectionCode: string;
  academicYear: number;
  term: number;
  closedSessions: number;
}

export interface StatsSummary {
  sections: number;
  closedSessions: number;
  students: number;
  attendanceRate: number | null;
  atRiskStudents: number;
}

/**
 * Attendance statistics. "Absent" is worked out, never stored: a closed
 * session without a check-in from a student counts as one absence. There is
 * no "late" - the lecturer decides the window by opening and closing.
 */
@Injectable()
export class AttendanceStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sections: ClassSectionsService,
  ) {}

  /** Sections the caller may see: their own, or every section for ADMIN. */
  private visibleWhere(user: CoreHubIdentity): Prisma.ClassSectionWhereInput {
    return can(user.subsystemRole, MANAGE_ANY) ? {} : { ownerCoreUserId: user.id };
  }

  async sectionPage(
    user: CoreHubIdentity,
    page: { skip: number; take: number },
    token: string,
  ): Promise<{ items: SectionStat[]; total: number }> {
    const where = this.visibleWhere(user);
    const [rows, total] = await Promise.all([
      this.prisma.classSection.findMany({
        where,
        orderBy: [{ courseCode: 'asc' }, { sectionCode: 'asc' }],
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.classSection.count({ where }),
    ]);
    const items = await this.withNames(rows, token, (section) => this.computeSection(section));
    return { items: items.map(({ stat }) => stat), total };
  }

  async summary(user: CoreHubIdentity): Promise<StatsSummary> {
    const rows = await this.prisma.classSection.findMany({ where: this.visibleWhere(user) });
    let closedSessions = 0;
    let students = 0;
    let atRiskStudents = 0;
    let expected = 0;
    let attended = 0;
    for (const section of rows) {
      const { stat, students: list } = await this.computeSection(section);
      closedSessions += stat.closedSessions;
      students += stat.studentCount;
      atRiskStudents += stat.atRiskCount;
      expected += stat.closedSessions * stat.studentCount;
      attended += list.reduce((sum, student) => sum + student.attended, 0);
    }
    return {
      sections: rows.length,
      closedSessions,
      students,
      attendanceRate: expected > 0 ? attended / expected : null,
      atRiskStudents,
    };
  }

  /** Every at-risk student across the sections the caller may see, worst first. */
  async atRisk(user: CoreHubIdentity, token: string): Promise<AtRiskEntry[]> {
    const rows = await this.prisma.classSection.findMany({
      where: this.visibleWhere(user),
      orderBy: [{ courseCode: 'asc' }, { sectionCode: 'asc' }],
    });
    const computed = await this.withNames(rows, token, (section) => this.computeSection(section));
    const entries: AtRiskEntry[] = [];
    for (const { stat, students } of computed) {
      for (const student of students.filter((candidate) => candidate.atRisk)) {
        entries.push({
          ...student,
          classSectionId: stat.classSectionId,
          courseCode: stat.courseCode,
          courseName: stat.courseName,
          sectionCode: stat.sectionCode,
          academicYear: stat.academicYear,
          term: stat.term,
          closedSessions: stat.closedSessions,
        });
      }
    }
    return entries.sort(
      (a, b) =>
        b.absenceRate - a.absenceRate ||
        a.courseCode.localeCompare(b.courseCode) ||
        a.personCode.localeCompare(b.personCode),
    );
  }

  async section(
    classSectionId: string,
    user: CoreHubIdentity,
    token: string,
  ): Promise<SectionStat & { students: StudentStat[] }> {
    const section = await this.sections.findOne(classSectionId);
    assertCanManageSection(section, user, MANAGE_ANY);
    const [{ stat, students }] = await this.withNames([section], token, (row) => this.computeSection(row));
    return { ...stat, students };
  }

  private async withNames(
    rows: ClassSection[],
    token: string,
    compute: (section: ClassSection) => Promise<{ stat: SectionStat; students: StudentStat[] }>,
  ): Promise<Array<{ stat: SectionStat; students: StudentStat[] }>> {
    const views = await this.sections.views(rows, token);
    const results = [];
    for (const [index, row] of rows.entries()) {
      const result = await compute(row);
      result.stat.courseName = views[index].courseName;
      results.push(result);
    }
    return results;
  }

  private async computeSection(
    section: ClassSection,
  ): Promise<{ stat: SectionStat; students: StudentStat[] }> {
    const closed = await this.prisma.attendanceSession.findMany({
      where: { classSectionId: section.id, status: AttendanceSessionStatus.CLOSED },
    });
    const closedIds = closed.map((session) => session.id);
    const records =
      closedIds.length > 0
        ? await this.prisma.attendanceRecord.findMany({
            where: { attendanceSessionId: { in: closedIds } },
          })
        : [];
    const roster = await this.prisma.classSectionStudent.findMany({
      where: { classSectionId: section.id },
    });

    // Sessions each student id checked in to (a set, so a repeat cannot count twice).
    const sessionsBy = new Map<string, Set<string>>();
    for (const record of records) {
      if (record.personCode === null) continue;
      const seen = sessionsBy.get(record.personCode) ?? new Set<string>();
      seen.add(record.attendanceSessionId);
      sessionsBy.set(record.personCode, seen);
    }

    const rosterCodes = roster.map((row) => row.personCode);
    const source: StudentSource = rosterCodes.length > 0 ? 'ROSTER' : 'CHECKED_IN';
    const codes = source === 'ROSTER' ? rosterCodes : [...sessionsBy.keys()];
    const onRoster = new Set(rosterCodes);
    const total = closedIds.length;

    const students: StudentStat[] = codes
      .map((personCode) => {
        const attended = sessionsBy.get(personCode)?.size ?? 0;
        const absent = Math.max(0, total - attended);
        const absenceRate = total > 0 ? absent / total : 0;
        return {
          personCode,
          attended,
          absent,
          absenceRate,
          atRisk: total > 0 && absenceRate >= AT_RISK_ABSENCE_RATE,
        };
      })
      .sort(
        (a, b) =>
          Number(b.atRisk) - Number(a.atRisk) ||
          b.absenceRate - a.absenceRate ||
          a.personCode.localeCompare(b.personCode),
      );

    const expected = total * students.length;
    const attendedTotal = students.reduce((sum, student) => sum + student.attended, 0);
    const stat: SectionStat = {
      classSectionId: section.id,
      courseCode: section.courseCode,
      courseName: section.courseName ?? section.courseCode,
      sectionCode: section.sectionCode,
      academicYear: section.academicYear,
      term: section.term,
      closedSessions: total,
      studentSource: source,
      studentCount: students.length,
      attendanceRate: expected > 0 ? attendedTotal / expected : null,
      atRiskCount: students.filter((student) => student.atRisk).length,
      offRosterCount:
        source === 'ROSTER' ? [...sessionsBy.keys()].filter((code) => !onRoster.has(code)).length : 0,
    };
    return { stat, students };
  }
}
