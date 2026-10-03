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

/** A check-in record always means the student attended - there is no "late". */
export type AttendanceRecord = Schemas["AttendanceRecordDto"];
export type SectionSummary = Schemas["SectionSummaryDto"];
export type AttendanceRecordView = Schemas["AttendanceRecordViewDto"];
/** GET /api/v1/attendance-records/me/summary */
export type AttendanceSummary = Schemas["AttendanceSummaryDto"];

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
