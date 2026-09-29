import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatNumber, formatTerm, formatTime, toBuddhistYear, toGregorianYear } from "./format";

describe("display formats - ui-design-system.md 11.3", () => {
  it("formats dates in the Buddhist era", () => {
    expect(formatDate("2026-08-11")).toBe("11 ส.ค. 2569");
    expect(formatDate("2026-08-11", "long")).toBe("11 สิงหาคม 2569");
  });

  it("always uses Asia/Bangkok, whatever the machine's timezone", () => {
    // 23:30 UTC on the 10th is already 06:30 on the 11th in Bangkok.
    expect(formatDateTime("2026-08-10T23:30:00Z")).toBe("11 ส.ค. 2569 06:30 น.");
    expect(formatTime("2026-08-11T02:30:00Z")).toBe("09:30 น.");
  });

  it("formats numbers with thousands separators", () => {
    expect(formatNumber(2450)).toBe("2,450");
  });

  it("converts between Gregorian and Buddhist years", () => {
    expect(toBuddhistYear(2026)).toBe(2569);
    expect(toGregorianYear(2569)).toBe(2026);
    expect(formatTerm(2, 2026)).toBe("ภาคเรียนที่ 2/2569");
  });
});
