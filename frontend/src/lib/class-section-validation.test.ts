import { describe, expect, it } from "vitest";
import { FIELD_ORDER, IDENTITY_FIELDS, toRequestBody, validateAll, validateField, type Values } from "./class-section-validation";

const VALID: Values = {
  courseCode: "CS201",
  courseName: "โครงสร้างข้อมูล",
  sectionCode: "1",
  academicYear: "2569",
  term: "1",
  latitude: "18.8925",
  longitude: "99.0142",
  radiusMeters: "50",
  lateAfterMinutes: "15",
};

describe("validateField - mirrors backend class-section DTOs", () => {
  it("accepts a complete valid form", () => {
    expect(validateAll(VALID, FIELD_ORDER)).toEqual({});
  });

  it.each([
    ["courseCode", "cs201"],
    ["courseCode", "C201"],
    ["courseCode", "CS20"],
    ["courseName", "   "],
    ["sectionCode", "1234"],
    ["sectionCode", "A"],
    ["academicYear", "2026"],
    ["term", "4"],
    ["latitude", "91"],
    ["latitude", ""],
    ["longitude", "-181"],
    ["radiusMeters", "5"],
    ["radiusMeters", "50.5"],
    ["lateAfterMinutes", "181"],
  ] as const)("rejects %s = %j", (field, value) => {
    expect(validateField(field, value)).toEqual(expect.any(String));
  });

  it.each([
    ["courseCode", "ABCD1234"],
    ["sectionCode", "01"],
    ["academicYear", "2543"],
    ["latitude", "-90"],
    ["radiusMeters", "500"],
    ["lateAfterMinutes", "0"],
  ] as const)("accepts boundary %s = %j", (field, value) => {
    expect(validateField(field, value)).toBeUndefined();
  });

  it("asks for the year in the Buddhist era, in Thai", () => {
    expect(validateField("academicYear", "2026")).toBe("กรอกปีการศึกษาเป็น พ.ศ. เช่น 2569");
  });

  it("returns errors in form order so the first one can be focused", () => {
    const errors = validateAll({ ...VALID, courseCode: "", radiusMeters: "1" }, FIELD_ORDER);
    expect(Object.keys(errors)).toEqual(["courseCode", "radiusMeters"]);
  });
});

describe("toRequestBody", () => {
  it("converts the Buddhist-era year to Gregorian and numbers to numbers on create", () => {
    expect(toRequestBody({ ...VALID, courseName: "  โครงสร้างข้อมูล  " }, false)).toEqual({
      courseCode: "CS201",
      courseName: "โครงสร้างข้อมูล",
      sectionCode: "1",
      academicYear: 2026,
      term: 1,
      latitude: 18.8925,
      longitude: 99.0142,
      radiusMeters: 50,
      lateAfterMinutes: 15,
    });
  });

  it("never sends identity fields on edit (the backend rejects them)", () => {
    const body = toRequestBody(VALID, true);
    for (const field of IDENTITY_FIELDS) {
      expect(body).not.toHaveProperty(field);
    }
    expect(body).toEqual({
      courseName: "โครงสร้างข้อมูล",
      latitude: 18.8925,
      longitude: 99.0142,
      radiusMeters: 50,
      lateAfterMinutes: 15,
    });
  });
});
