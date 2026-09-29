import { Badge, formatDateTime, formatTerm } from "@csmju2030/design-system";
import type { AttendanceRecordView, AttendanceStatus } from "@/lib/types";

export const ATTENDANCE_STATUS: Record<AttendanceStatus, { label: string; tone: "success" | "warning" }> = {
  PRESENT: { label: "มาตรงเวลา", tone: "success" },
  LATE: { label: "มาสาย", tone: "warning" },
};

/** A student's own check-ins. Cards on every width - rows are short. */
export function AttendanceRecordList({ records }: { records: AttendanceRecordView[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {records.map((record) => {
        const status = ATTENDANCE_STATUS[record.status];
        const section = record.classSection;
        return (
          <li key={record.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-ink">
                {section ? `${section.courseCode} ${section.courseName}` : "กลุ่มเรียนถูกลบไปแล้ว"}
              </p>
              <p className="text-sm text-muted tabular-nums">
                {section ? `กลุ่ม ${section.sectionCode} · ${formatTerm(section.term, section.academicYear)} · ` : ""}
                {formatDateTime(record.checkedInAt)}
              </p>
            </div>
            <div>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
