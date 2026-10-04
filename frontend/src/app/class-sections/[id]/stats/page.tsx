import type { Metadata } from "next";
import {
  Alert,
  AlertTriangleIcon,
  Badge,
  ButtonLink,
  Card,
  CardTitle,
  EmptyState,
  PageHeaderBar,
  PresentationIcon,
  StatCard,
  UsersIcon,
  formatNumber,
  formatPercent,
  formatTerm,
} from "@/components/shared/kit";
import { CsvDownloadButton } from "@/components/features/csv-download-button";
import { ApiErrorView } from "@/components/shared/api-error-view";
import { sectionStudentsCsv } from "@/lib/at-risk";
import { apiGet, getMe } from "@/lib/api-server";
import type { SectionStatDetail, StudentStat } from "@/lib/types";

export const metadata: Metadata = { title: "สถิติของกลุ่มเรียน" };

export default async function SectionStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me.ok) {
    return null;
  }
  const sectionHref = `/class-sections/${id}`;
  const result = await apiGet<SectionStatDetail>(`/api/v1/attendance-stats/sections/${encodeURIComponent(id)}`);
  if (!result.ok) {
    return <ApiErrorView error={result.error} retryHref={`${sectionHref}/stats`} backHref={sectionHref} />;
  }
  const stat = result.data;
  const atRisk = stat.students.filter((student) => student.atRisk);

  return (
    <>
      <PageHeaderBar
        title="สถิติและกลุ่มเสี่ยง"
        description={`${stat.courseCode} ${stat.courseName} · กลุ่ม ${stat.sectionCode} · ${formatTerm(stat.term, stat.academicYear)}`}
        back={{ href: sectionHref, label: "กลุ่มเรียน" }}
        actions={
          stat.closedSessions > 0 && stat.students.length > 0 ? (
            <CsvDownloadButton
              csv={sectionStudentsCsv(stat.students, stat.closedSessions)}
              fileName={`attendance-stats-${stat.courseCode}-${stat.sectionCode}-${stat.academicYear + 543}-${stat.term}.csv`}
              label="ดาวน์โหลด CSV"
            />
          ) : null
        }
      />

      {stat.studentSource === "CHECKED_IN" ? (
        <Alert
          tone="warning"
          title="กลุ่มเรียนนี้ยังไม่มีรายชื่อนักศึกษา"
          action={
            <ButtonLink href={`${sectionHref}/students`} variant="secondary">
              เพิ่มรายชื่อนักศึกษา
            </ButtonLink>
          }
        >
          ตอนนี้คำนวณจากคนที่เคยเช็คชื่ออย่างน้อยหนึ่งครั้ง คนที่ไม่เคยมาเลยจะไม่อยู่ในสถิติจนกว่าจะเพิ่มรายชื่อ
        </Alert>
      ) : null}

      <section aria-label="สรุปกลุ่มเรียน" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="รอบที่ปิดแล้ว" value={formatNumber(stat.closedSessions)} unit="รอบ" icon={<PresentationIcon />} />
        <StatCard label="นักศึกษา" value={formatNumber(stat.studentCount)} unit="คน" icon={<UsersIcon />} tone="neutral" />
        <StatCard label="อัตราเข้าเรียน" value={formatPercent(stat.attendanceRate)} icon={<UsersIcon />} tone="success" />
        <StatCard
          label="กลุ่มเสี่ยง"
          value={formatNumber(stat.atRiskCount)}
          unit="คน"
          hint="ขาดตั้งแต่ 30%"
          icon={<AlertTriangleIcon />}
          tone={stat.atRiskCount > 0 ? "danger" : "neutral"}
        />
      </section>

      {stat.offRosterCount > 0 ? (
        <Alert tone="info" title={`มีคนเช็คชื่อที่ไม่อยู่ในรายชื่อ ${formatNumber(stat.offRosterCount)} คน`}>
          ไม่นับในสถิติ ดูได้ในหน้าประวัติการเช็คชื่อ (ติดป้าย &quot;ไม่อยู่ในรายชื่อ&quot;)
        </Alert>
      ) : null}

      {stat.closedSessions === 0 ? (
        <Card>
          <EmptyState
            icon={PresentationIcon}
            title="ยังไม่มีรอบที่ปิดแล้ว"
            description="สถิตินับเฉพาะรอบที่ปิดแล้ว เปิดรอบเช็คชื่อแล้วกดปิดเมื่อจบการเช็คชื่อ"
          />
        </Card>
      ) : (
        <>
          <StudentTable title={`กลุ่มเสี่ยง (${formatNumber(atRisk.length)} คน)`} students={atRisk} total={stat.closedSessions} empty="ไม่มีนักศึกษาในกลุ่มเสี่ยง" />
          <StudentTable title={`นักศึกษาทั้งหมด (${formatNumber(stat.students.length)} คน)`} students={stat.students} total={stat.closedSessions} empty="ยังไม่มีนักศึกษา" />
        </>
      )}
    </>
  );
}

function StudentTable({ title, students, total, empty }: { title: string; students: StudentStat[]; total: number; empty: string }) {
  return (
    <Card flush className="flex flex-col">
      <div className="px-4 pt-4 md:px-6 md:pt-6">
        <CardTitle>{title}</CardTitle>
      </div>
      {students.length === 0 ? (
        <p className="px-4 py-4 text-on-surface-variant md:px-6">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-outline-variant/40 border-t border-outline-variant/40">
          {students.map((student) => (
            <li key={student.personCode} className="flex items-center gap-3 px-4 py-3 md:px-6">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-mono font-semibold text-on-surface tabular-nums">{student.personCode}</span>
                <span className="text-sm/relaxed text-on-surface-variant tabular-nums">
                  มา {formatNumber(student.attended)}/{formatNumber(total)} รอบ · ขาด {formatNumber(student.absent)} รอบ
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className={`font-semibold tabular-nums ${student.atRisk ? "text-error" : "text-on-surface"}`}>
                  ขาด {formatPercent(student.absenceRate)}
                </span>
                {student.atRisk ? <Badge tone="danger">กลุ่มเสี่ยง</Badge> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
