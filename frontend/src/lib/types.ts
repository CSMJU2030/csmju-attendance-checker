/*
 * Response shapes of the attendance-checker backend, generated from
 * backend/openapi.json (tech-stack.md section 3 - no hand-written API types).
 *
 * After a backend change: `pnpm --filter backend generate:openapi`, then
 * `pnpm --filter frontend generate:api-types`, and commit both files.
 * This module only gives the generated schemas the names the screens use.
 */
import type { components } from "./api-schema";

type Schemas = components["schemas"];

export type SubsystemRole = Schemas["SubsystemRole"];
export type Me = Schemas["MeDto"];

export type ClassSection = Schemas["ClassSectionDto"];
/** Body of POST /api/v1/class-sections; PATCH takes a subset of it. */
export type ClassSectionInput = Schemas["CreateClassSectionDto"];

export type AttendanceSessionStatus = Schemas["AttendanceSessionStatus"];
export type AttendanceSession = Schemas["AttendanceSessionDto"];
export type CurrentCode = Schemas["CurrentCodeDto"];

/**
 * A check-in as staff see it, with `inRoster` (null while the section has no
 * roster). A check-in always means the student attended - there is no "late".
 */
export type StaffAttendanceRecord = Schemas["StaffAttendanceRecordDto"];
export type SectionSummary = Schemas["SectionSummaryDto"];
export type AttendanceRecordView = Schemas["AttendanceRecordViewDto"];
/** GET /api/v1/attendance-records/me/summary */
export type AttendanceSummary = Schemas["AttendanceSummaryDto"];

export type RosterStudent = Schemas["RosterStudentDto"];
export type AddRosterStudentsResult = Schemas["AddRosterStudentsResultDto"];
/** A student from Core Hub's /people, shown while picking a roster - never stored. */
export type StudentSummary = Schemas["StudentSummaryDto"];
export type Department = Schemas["DepartmentDto"];
/** An open Core Hub course, for the class section form. */
export type CourseSummary = Schemas["CourseSummaryDto"];

/** Attendance statistics; rates are 0-1, absent = closed session without a check-in. */
export type StatsSummary = Schemas["StatsSummaryDto"];
export type SectionStat = Schemas["SectionStatDto"];
export type SectionStatDetail = Schemas["SectionStatDetailDto"];
export type StudentStat = Schemas["StudentStatDto"];

export type PageMeta = Schemas["PageMetaDto"];
export type ErrorCode = Schemas["ErrorCode"];

/** An error envelope from the backend, or NETWORK_ERROR when no answer arrived. */
export interface ApiError {
  code: ErrorCode | "NETWORK_ERROR";
  message: string;
  details?: unknown;
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T; meta?: PageMeta }
  | { ok: false; status: number; error: ApiError };
