import { toGregorianYear } from "@/components/shared/kit";
import type { ClassSectionInput } from "./types";

/*
 * Client-side rules of the class-section form. They mirror
 * backend/src/class-sections/dto/*.dto.ts so the user gets a Thai message
 * under the field before the request is sent; the backend still validates.
 */

export type FieldName =
  | "courseCode"
  | "sectionCode"
  | "academicYear"
  | "term"
  | "latitude"
  | "longitude"
  | "radiusMeters";

export type Values = Record<FieldName, string>;
export type Errors = Partial<Record<FieldName, string>>;

export const FIELD_ORDER: FieldName[] = [
  "courseCode",
  "sectionCode",
  "academicYear",
  "term",
  "latitude",
  "longitude",
  "radiusMeters",
];

/** Course code, section, year and term identify a section and cannot change. */
export const IDENTITY_FIELDS: FieldName[] = ["courseCode", "sectionCode", "academicYear", "term"];

function isNumberIn(value: string, min: number, max: number, integer = false): boolean {
  if (value.trim() === "") {
    return false;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isInteger(number));
}

export function validateField(name: FieldName, value: string): string | undefined {
  switch (name) {
    case "courseCode":
      // Picked from Core Hub's course list - the backend checks it exists and is open.
      return /^[0-9A-Za-z][0-9A-Za-z_.-]{0,39}$/.test(value) ? undefined : "ค้นหาแล้วเลือกรายวิชาจากรายการ";
    case "sectionCode":
      return /^\d{1,3}$/.test(value) ? undefined : "กลุ่มเรียนต้องเป็นตัวเลข 1–3 หลัก เช่น 1";
    case "academicYear":
      return isNumberIn(value, 2543, 2643, true) ? undefined : "กรอกปีการศึกษาเป็น พ.ศ. เช่น 2569";
    case "term":
      return isNumberIn(value, 1, 3, true) ? undefined : "เลือกภาคเรียน";
    case "latitude":
      return isNumberIn(value, -90, 90) ? undefined : "ละติจูดต้องเป็นตัวเลขระหว่าง -90 ถึง 90";
    case "longitude":
      return isNumberIn(value, -180, 180) ? undefined : "ลองจิจูดต้องเป็นตัวเลขระหว่าง -180 ถึง 180";
    case "radiusMeters":
      return isNumberIn(value, 10, 500, true) ? undefined : "รัศมีต้องเป็นจำนวนเต็ม 10–500 เมตร";
  }
}

/** Every error of the given fields, in form order. */
export function validateAll(values: Values, fields: readonly FieldName[]): Errors {
  const errors: Errors = {};
  for (const name of fields) {
    const error = validateField(name, values[name]);
    if (error) {
      errors[name] = error;
    }
  }
  return errors;
}

/**
 * Body for POST (create) or PATCH (edit). The year is typed in the Buddhist
 * era and sent in the Gregorian calendar; identity fields are never sent on
 * edit because the backend does not allow changing them.
 */
export function toRequestBody(values: Values, editing: boolean): Partial<ClassSectionInput> {
  const editable = {
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    radiusMeters: Number(values.radiusMeters),
  };
  if (editing) {
    return editable;
  }
  return {
    ...editable,
    courseCode: values.courseCode,
    sectionCode: values.sectionCode,
    academicYear: toGregorianYear(Number(values.academicYear)),
    term: Number(values.term),
  };
}
