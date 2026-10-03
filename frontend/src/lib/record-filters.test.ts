import { describe, expect, it } from "vitest";
import {
  hasFilters,
  nextDay,
  rangeError,
  readRecordFilters,
  recordsApiQuery,
  recordsCsv,
  recordsPageQuery,
} from "./record-filters";
import type { AttendanceRecord } from "./types";

const SECTION = "11111111-1111-4111-8111-111111111111";

function record(overrides: Partial<AttendanceRecord>): AttendanceRecord {
  return {
    id: "r1",
    attendanceSessionId: "s1",
    coreUserId: "user-001",
    personCode: "6504101234",
    // 09:05 in Bangkok
    checkedInAt: "2026-09-29T02:05:00.000Z",
    distanceMeters: 12,
    createdAt: "2026-09-29T02:05:00.000Z",
    updatedAt: "2026-09-29T02:05:00.000Z",
    ...overrides,
  };
}

describe("readRecordFilters", () => {
  it("keeps well-formed values", () => {
    expect(readRecordFilters({ personCode: " 650410 ", from: "2026-09-01", to: "2026-09-30" })).toEqual({
      personCode: "650410",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("drops malformed values instead of sending them on", () => {
    expect(readRecordFilters({ personCode: "65%", from: "2026-02-30", to: "yesterday" })).toEqual({
      personCode: "",
      from: "",
      to: "",
    });
    expect(hasFilters(readRecordFilters({}))).toBe(false);
  });
});

describe("date range", () => {
  it("finds the next calendar day across month and year ends", () => {
    expect(nextDay("2026-09-30")).toBe("2026-10-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
  });

  it("flags a range whose start is after its end", () => {
    expect(rangeError({ personCode: "", from: "2026-09-30", to: "2026-09-01" })).not.toBeNull();
    expect(rangeError({ personCode: "", from: "2026-09-01", to: "2026-09-01" })).toBeNull();
  });

  it("sends whole Bangkok days as a half-open instant range", () => {
    const query = new URLSearchParams(
      recordsApiQuery(SECTION, { personCode: "6504", from: "2026-09-01", to: "2026-09-30" }, 2, 50),
    );
    expect(Object.fromEntries(query)).toEqual({
      classSectionId: SECTION,
      page: "2",
      limit: "50",
      personCode: "6504",
      from: "2026-09-01T00:00:00+07:00",
      to: "2026-10-01T00:00:00+07:00",
    });
  });

  it("keeps only the filters that are set in the page URL", () => {
    expect(recordsPageQuery({ personCode: "", from: "2026-09-01", to: "" })).toBe("from=2026-09-01");
    expect(recordsPageQuery({ personCode: "65", from: "", to: "" }, 3)).toBe("personCode=65&page=3");
  });
});

describe("recordsCsv", () => {
  it("starts with a BOM, uses CRLF and shows Bangkok time in the Buddhist era", () => {
    const csv = recordsCsv([record({}), record({ id: "r2", personCode: null })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("วันที่,เวลา,รหัสนักศึกษา,ระยะห่างจากจุดเช็คชื่อ (เมตร)");
    expect(lines[1]).toBe("29 ก.ย. 2569,09:05 น.,6504101234,12");
    expect(lines[2]).toBe("29 ก.ย. 2569,09:05 น.,,12");
    expect(lines[3]).toBe("");
  });

  it("defuses spreadsheet formulas and quotes special characters", () => {
    const csv = recordsCsv([record({ personCode: "=1+1" }), record({ personCode: 'a,"b"' })]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toContain(",'=1+1,");
    expect(lines[2]).toContain(',"a,""b""",');
  });
});
