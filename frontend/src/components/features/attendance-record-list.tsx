import {
  Badge,
  CheckCircleIcon,
  dayKey,
  formatDateTime,
  formatDayLabel,
  formatTerm,
  formatTime,
} from "@/components/shared/kit";
import type { AttendanceRecordView } from "@/lib/types";

/**
 * A check-in record always means the student attended: there is no "late",
 * the lecturer decides the window by opening and closing the session.
 */
export const ATTENDED_LABEL = "มาเรียน";

/** Inside a day group only the time is shown; elsewhere the full date too. */
function RecordRow({ record, withDate }: { record: AttendanceRecordView; withDate: boolean }) {
  const section = record.classSection;
  return (
    <li className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-emerald-700"
      >
        <CheckCircleIcon size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-semibold text-on-surface">
          {section ? `${section.courseCode} ${section.courseName}` : "กลุ่มเรียนถูกลบไปแล้ว"}
        </p>
        <p className="text-sm/relaxed text-on-surface-variant tabular-nums">
          {withDate ? formatDateTime(record.checkedInAt) : formatTime(record.checkedInAt)}
          {section ? ` · กลุ่ม ${section.sectionCode}` : ""}
          {section ? <span className="hidden sm:inline"> · {formatTerm(section.term, section.academicYear)}</span> : null}
        </p>
      </div>
      <Badge tone="success">{ATTENDED_LABEL}</Badge>
    </li>
  );
}

/**
 * A student's own check-ins, newest first. With `groupByDay` the list gets a
 * heading per Bangkok calendar day ("วันนี้", "เมื่อวาน", then the date).
 */
export function AttendanceRecordList({ records, groupByDay = false }: { records: AttendanceRecordView[]; groupByDay?: boolean }) {
  if (!groupByDay) {
    return (
      <ul className="flex flex-col divide-y divide-outline-variant/40">
        {records.map((record) => (
          <RecordRow key={record.id} record={record} withDate />
        ))}
      </ul>
    );
  }

  const days: Array<{ key: string; label: string; items: AttendanceRecordView[] }> = [];
  for (const record of records) {
    const key = dayKey(record.checkedInAt);
    const day = days.at(-1);
    if (day && day.key === key) {
      day.items.push(record);
    } else {
      days.push({ key, label: formatDayLabel(record.checkedInAt), items: [record] });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {days.map((day) => (
        <section key={day.key} aria-labelledby={`day-${day.key}`} className="flex flex-col gap-3">
          <h2 id={`day-${day.key}`} className="flex items-center gap-2 text-sm/relaxed font-semibold text-on-surface-variant">
            {day.label}
            <span className="font-normal tabular-nums">· {day.items.length} รายการ</span>
          </h2>
          <ul className="flex flex-col divide-y divide-outline-variant/40">
            {day.items.map((record) => (
              <RecordRow key={record.id} record={record} withDate={false} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
