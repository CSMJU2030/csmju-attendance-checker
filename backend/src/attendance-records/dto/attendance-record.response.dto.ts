/**
 * One student's check-in - its existence means the student attended; there
 * is no "late". Only ids are kept - no name, no e-mail.
 */
export class AttendanceRecordDto {
  id!: string;
  attendanceSessionId!: string;
  /** Core Hub user id (`sub`) of the student. */
  coreUserId!: string;
  /** Student id from Core Hub's /people/me; null for an account not linked to a person. */
  personCode!: string | null;

  checkedInAt!: Date;
  /** Distance from the room's check-in point, in meters. */
  distanceMeters!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

/** A check-in as staff see it: also says whether the student is on the roster. */
export class StaffAttendanceRecordDto extends AttendanceRecordDto {
  /** On the section's roster? `null` while the section has no roster yet. */
  inRoster!: boolean | null;
}

export class SectionSummaryDto {
  courseCode!: string;
  courseName!: string;
  sectionCode!: string;
  academicYear!: number;
  term!: number;
}

/** A check-in with the class section it belongs to (null once the section is deleted). */
export class AttendanceRecordViewDto extends AttendanceRecordDto {
  classSection!: SectionSummaryDto | null;
}

/** GET /api/v1/attendance-records/me/summary */
export class AttendanceSummaryDto {
  /** Sessions the student checked in to. */
  total!: number;
}
