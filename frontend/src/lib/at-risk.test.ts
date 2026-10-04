import { describe, expect, it } from "vitest";
import { atRiskCsv, atRiskKey, sectionStudentsCsv, unseenEntries } from "./at-risk";
import type { AtRiskEntry } from "./types";

const entry = (personCode: string, absenceRate: number, classSectionId = "sec-1"): AtRiskEntry => ({
  classSectionId,
  courseCode: "10301111-1",
  courseName: "การเขียนโปรแกรมคอมพิวเตอร์",
  sectionCode: "1",
  academicYear: 2026,
  term: 1,
  closedSessions: 4,
  personCode,
  attended: Math.round(4 * (1 - absenceRate)),
  absent: Math.round(4 * absenceRate),
  absenceRate,
  atRisk: true,
});

describe("unseenEntries", () => {
  it("keeps only students not acknowledged yet, per section", () => {
    const entries = [entry("6501", 1), entry("6502", 0.5), entry("6501", 0.5, "sec-2")];
    const seen = new Set([atRiskKey(entries[0])]);
    expect(unseenEntries(entries, seen).map(atRiskKey)).toEqual(["sec-1:6502", "sec-2:6501"]);
  });
});

describe("at-risk CSV", () => {
  it("lists course, term, student and absences with a BOM", () => {
    const csv = atRiskCsv([entry("6504101234", 0.5)]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("รหัสวิชา,ชื่อวิชา,กลุ่ม,ภาคเรียน,รหัสนักศึกษา,มา (รอบ),ขาด (รอบ),รอบที่ปิดแล้ว,ขาด (%)");
    expect(lines[1]).toBe("10301111-1,การเขียนโปรแกรมคอมพิวเตอร์,1,ภาคเรียนที่ 1/2569,6504101234,2,2,4,50%");
  });

  it("marks who is at risk in a section export", () => {
    const csv = sectionStudentsCsv(
      [
        { personCode: "6501", attended: 0, absent: 4, absenceRate: 1, atRisk: true },
        { personCode: "6502", attended: 3, absent: 1, absenceRate: 0.25, atRisk: false },
      ],
      4,
    );
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe("6501,0,4,4,100%,ใช่");
    expect(lines[2]).toBe("6502,3,1,4,25%,ไม่ใช่");
  });
});
