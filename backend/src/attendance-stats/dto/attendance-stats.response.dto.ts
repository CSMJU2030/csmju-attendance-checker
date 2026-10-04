import { ApiProperty } from '@nestjs/swagger';

export class StudentStatDto {
  personCode!: string;
  /** Closed sessions the student checked in to. */
  attended!: number;
  /** Closed sessions without a check-in from the student. */
  absent!: number;
  /** 0-1 share of the closed sessions the student missed. */
  absenceRate!: number;
  /** Missed at least 30% of the closed sessions. */
  atRisk!: boolean;
}

export class SectionStatDto {
  classSectionId!: string;
  courseCode!: string;
  courseName!: string;
  sectionCode!: string;
  academicYear!: number;
  term!: number;
  /** Only closed sessions count: an open one may still be taking check-ins. */
  closedSessions!: number;

  /** ROSTER: the section's roster. CHECKED_IN: no roster yet, so only students who checked in at least once. */
  @ApiProperty({ enum: ['ROSTER', 'CHECKED_IN'], enumName: 'StudentSource' })
  studentSource!: 'ROSTER' | 'CHECKED_IN';

  studentCount!: number;
  /** 0-1 share of expected check-ins that happened; null before the first closed session. */
  attendanceRate!: number | null;
  atRiskCount!: number;
  /** Students who checked in but are not on the roster. */
  offRosterCount!: number;
}

export class SectionStatDetailDto extends SectionStatDto {
  /** At-risk students first, then by absence rate. */
  students!: StudentStatDto[];
}

export class StatsSummaryDto {
  sections!: number;
  closedSessions!: number;
  students!: number;
  /** 0-1, across every visible section; null before the first closed session. */
  attendanceRate!: number | null;
  atRiskStudents!: number;
}
