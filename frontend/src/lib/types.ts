/*
 * Response shapes of the attendance-checker backend.
 *
 * tech-stack.md section 3 asks for types generated from the backend's
 * openapi.json; the backend does not publish one yet (no @nestjs/swagger), so
 * these mirror backend/src/**\/*.dto.ts and the Prisma models by hand. Replace
 * this file with `openapi-typescript` output once openapi.json exists.
 */

export type SubsystemRole = "STUDENT" | "ALUMNI" | "STAFF" | "ADMIN";

export interface Me {
  id: string;
  email: string;
  coreRole: string;
  subsystemRole: SubsystemRole;
  /** `expiresAt` is the token's exp: past it, the next call returns 401 and /auth/login runs again. */
  session: { expiresAt: string | null };
}

export interface ClassSection {
  id: string;
  courseCode: string;
  courseName: string;
  sectionCode: string;
  academicYear: number;
  term: number;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  ownerCoreUserId: string;
  createdAt: string;
  updatedAt: string;
}

export type ClassSectionInput = Pick<
  ClassSection,
  | "courseCode"
  | "courseName"
  | "sectionCode"
  | "academicYear"
  | "term"
  | "latitude"
  | "longitude"
  | "radiusMeters"
>;

export type AttendanceSessionStatus = "OPEN" | "CLOSED";

export interface AttendanceSession {
  id: string;
  classSectionId: string;
  openedByCoreUserId: string;
  status: AttendanceSessionStatus;
  openedAt: string;
  closedAt: string | null;
  /** Students who checked in to this session. */
  recordCount: number;
}

export interface CurrentCode {
  code: string;
  expiresAt: string;
  stepSeconds: number;
}

export interface AttendanceRecord {
  id: string;
  attendanceSessionId: string;
  coreUserId: string;
  /** Student id from Core Hub's /people/me; null for an account not linked to a person. No e-mail is kept. */
  personCode: string | null;
  checkedInAt: string;
  distanceMeters: number;
  createdAt: string;
  updatedAt: string;
}

export interface SectionSummary {
  courseCode: string;
  courseName: string;
  sectionCode: string;
  academicYear: number;
  term: number;
}

export type AttendanceRecordView = AttendanceRecord & { classSection: SectionSummary | null };

/** GET /api/v1/attendance-records/me/summary */
export interface AttendanceSummary {
  /** Sessions the student checked in to. */
  total: number;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export interface ApiError {
  code: ErrorCode | "NETWORK_ERROR";
  message: string;
  details?: unknown;
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T; meta?: PageMeta }
  | { ok: false; status: number; error: ApiError };
