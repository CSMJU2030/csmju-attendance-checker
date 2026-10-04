import { formatPercent, formatTerm } from "@/components/shared/kit/format";
import { toCsv } from "./csv";
import type { AtRiskEntry, StudentStat } from "./types";

/** Identifies one student in one section - what the dashboard alert remembers as seen. */
export function atRiskKey(entry: Pick<AtRiskEntry, "classSectionId" | "personCode">): string {
  return `${entry.classSectionId}:${entry.personCode}`;
}

/** Entries not acknowledged yet, in their original (worst first) order. */
export function unseenEntries(entries: AtRiskEntry[], seen: ReadonlySet<string>): AtRiskEntry[] {
  return entries.filter((entry) => !seen.has(atRiskKey(entry)));
}

/** At-risk students across sections, for Excel. */
export function atRiskCsv(entries: AtRiskEntry[]): string {
  return toCsv(
    ["รหัสวิชา", "ชื่อวิชา", "กลุ่ม", "ภาคเรียน", "รหัสนักศึกษา", "มา (รอบ)", "ขาด (รอบ)", "รอบที่ปิดแล้ว", "ขาด (%)"],
    entries.map((entry) => [
      entry.courseCode,
      entry.courseName,
      entry.sectionCode,
      formatTerm(entry.term, entry.academicYear),
      entry.personCode,
      String(entry.attended),
      String(entry.absent),
      String(entry.closedSessions),
      formatPercent(entry.absenceRate),
    ]),
  );
}

/** Every student of one section, for Excel. */
export function sectionStudentsCsv(students: StudentStat[], closedSessions: number): string {
  return toCsv(
    ["รหัสนักศึกษา", "มา (รอบ)", "ขาด (รอบ)", "รอบที่ปิดแล้ว", "ขาด (%)", "กลุ่มเสี่ยง"],
    students.map((student) => [
      student.personCode,
      String(student.attended),
      String(student.absent),
      String(closedSessions),
      formatPercent(student.absenceRate),
      student.atRisk ? "ใช่" : "ไม่ใช่",
    ]),
  );
}
