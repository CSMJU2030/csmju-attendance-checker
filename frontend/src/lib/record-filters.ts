import { formatDate, formatTime } from "@/components/shared/kit/format";
import { firstParam } from "./search-params";
import type { AttendanceRecord } from "./types";

type Param = string | string[] | undefined;

/** Search over one class section's check-ins, as it appears in the page URL. */
export interface RecordFilters {
  /** Student id or its leading digits. */
  personCode: string;
  /** Calendar days in Asia/Bangkok, `YYYY-MM-DD`; both inclusive. */
  from: string;
  to: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PERSON_CODE = /^[0-9A-Za-z-]{1,20}$/;

function isDay(value: string): boolean {
  if (!DAY.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Reads the filters from `?personCode=&from=&to=`, dropping anything malformed. */
export function readRecordFilters(params: Record<string, Param>): RecordFilters {
  const personCode = (firstParam(params.personCode) ?? "").trim();
  const from = firstParam(params.from) ?? "";
  const to = firstParam(params.to) ?? "";
  return {
    personCode: PERSON_CODE.test(personCode) ? personCode : "",
    from: isDay(from) ? from : "",
    to: isDay(to) ? to : "",
  };
}

export function hasFilters(filters: RecordFilters): boolean {
  return filters.personCode !== "" || filters.from !== "" || filters.to !== "";
}

/** A message for the form when the range is upside down, else null. */
export function rangeError(filters: RecordFilters): string | null {
  return filters.from && filters.to && filters.from > filters.to
    ? "วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด"
    : null;
}

/** `YYYY-MM-DD` of the following calendar day. */
export function nextDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Query string for GET /api/v1/attendance-records. The backend takes a
 * half-open instant range, so the days are turned into Bangkok midnights and
 * `to` moves to the start of the day after.
 */
export function recordsApiQuery(sectionId: string, filters: RecordFilters, page: number, limit: number): string {
  const query = new URLSearchParams({ classSectionId: sectionId, page: String(page), limit: String(limit) });
  if (filters.personCode) {
    query.set("personCode", filters.personCode);
  }
  if (filters.from) {
    query.set("from", `${filters.from}T00:00:00+07:00`);
  }
  if (filters.to) {
    query.set("to", `${nextDay(filters.to)}T00:00:00+07:00`);
  }
  return query.toString();
}

/** The page's own URL for these filters (only the ones that are set). */
export function recordsPageQuery(filters: RecordFilters, page = 1): string {
  const query = new URLSearchParams();
  for (const key of ["personCode", "from", "to"] as const) {
    if (filters[key]) {
      query.set(key, filters[key]);
    }
  }
  if (page > 1) {
    query.set("page", String(page));
  }
  return query.toString();
}

/**
 * One CSV cell. Quotes when needed, and defuses values a spreadsheet would
 * run as a formula (OWASP CSV injection).
 */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const BOM = String.fromCharCode(0xfeff);

/** CSV for Excel: a UTF-8 BOM so Thai text opens correctly, and CRLF line ends. */
export function recordsCsv(records: AttendanceRecord[]): string {
  const header = ["วันที่", "เวลา", "รหัสนักศึกษา", "ระยะห่างจากจุดเช็คชื่อ (เมตร)"];
  const rows = records.map((record) => [
    formatDate(record.checkedInAt),
    formatTime(record.checkedInAt),
    record.personCode ?? "",
    String(record.distanceMeters),
  ]);
  return `${BOM}${[header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
