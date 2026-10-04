import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangleIcon,
  Badge,
  BookOpenIcon,
  Card,
  ChevronRightIcon,
  EmptyState,
  PageHeaderBar,
  Pagination,
  PresentationIcon,
  StatCard,
  UsersIcon,
  formatNumber,
  formatPercent,
  formatTerm,
} from "@/components/shared/kit";
import { ApiErrorView } from "@/components/shared/api-error-view";
import { apiGet, getMe } from "@/lib/api-server";
import { can } from "@/lib/permissions";
import { pageParam } from "@/lib/search-params";
import type { SectionStat, StatsSummary } from "@/lib/types";

export const metadata: Metadata = { title: "สถิติและกลุ่มเสี่ยง" };

const PAGE_SIZE = 20;

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await getMe();
  if (!me.ok) {
    return null;
  }
  const role = me.data.subsystemRole;
  if (!can(role, "attendance-session:manage:own") && !can(role, "attendance-session:manage:any")) {
    return <ApiErrorView error={{ code: "FORBIDDEN", message: "" }} retryHref="/stats" />;
  }
  const page = pageParam((await searchParams).page);
  const [summary, sections] = await Promise.all([
    apiGet<StatsSummary>("/api/v1/attendance-stats/summary"),
    apiGet<SectionStat[]>(`/api/v1/attendance-stats/sections?page=${page}&limit=${PAGE_SIZE}`),
  ]);
  const everySection = can(role, "attendance-session:manage:any");

  return (
    <>
      <PageHeaderBar
        title="สถิติและกลุ่มเสี่ยง"
        description={everySection ? "ทุกกลุ่มเรียนในระบบ" : "กลุ่มเรียนที่คุณเป็นผู้สอน"}
      />
      <p className="max-w-prose text-on-surface-variant">
        นับเฉพาะรอบเช็คชื่อที่ปิดแล้ว นักศึกษาที่ไม่ได้เช็คชื่อในรอบที่ปิดแล้วนับว่าขาด และคนที่ขาดตั้งแต่ 30%
        ของรอบที่ปิดแล้วอยู่ในกลุ่มเสี่ยง
      </p>

      {summary.ok ? (
        <section aria-label="สรุปภาพรวม" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="กลุ่มเรียน" value={formatNumber(summary.data.sections)} unit="กลุ่ม" icon={<BookOpenIcon />} tone="neutral" />
          <StatCard label="รอบที่ปิดแล้ว" value={formatNumber(summary.data.closedSessions)} unit="รอบ" icon={<PresentationIcon />} />
          <StatCard
            label="อัตราเข้าเรียนเฉลี่ย"
            value={formatPercent(summary.data.attendanceRate)}
            hint={`จากนักศึกษา ${formatNumber(summary.data.students)} คน`}
            icon={<UsersIcon />}
            tone="success"
          />
          <StatCard
            label="นักศึกษากลุ่มเสี่ยง"
            value={formatNumber(summary.data.atRiskStudents)}
            unit="คน"
            hint="ขาดตั้งแต่ 30%"
            icon={<AlertTriangleIcon />}
            tone={summary.data.atRiskStudents > 0 ? "danger" : "neutral"}
          />
        </section>
      ) : (
        <ApiErrorView error={summary.error} retryHref="/stats" />
      )}

      {!sections.ok ? (
        <ApiErrorView error={sections.error} retryHref="/stats" />
      ) : sections.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpenIcon}
            title="ยังไม่มีกลุ่มเรียน"
            description="สร้างกลุ่มเรียนและเปิดรอบเช็คชื่อ แล้วสถิติจะแสดงที่นี่เมื่อปิดรอบแรก"
          />
        </Card>
      ) : (
        <Card flush className="flex flex-col gap-6">
          <ul className="flex flex-col divide-y divide-outline-variant/40">
            {sections.data.map((section) => (
              <li key={section.classSectionId}>
                <Link
                  href={`/class-sections/${section.classSectionId}/stats`}
                  className="group flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-primary-container/10 md:px-6"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-semibold text-on-surface">
                      <span className="font-mono text-sm/relaxed text-on-surface-variant">{section.courseCode}</span> {section.courseName}
                    </span>
                    <span className="text-sm/relaxed text-on-surface-variant tabular-nums">
                      กลุ่ม {section.sectionCode} · {formatTerm(section.term, section.academicYear)} · ปิดแล้ว{" "}
                      {formatNumber(section.closedSessions)} รอบ · นักศึกษา {formatNumber(section.studentCount)} คน
                      {section.studentSource === "CHECKED_IN" ? " (ยังไม่มีรายชื่อ)" : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-display text-[20px]/[1.5] font-semibold text-on-surface tabular-nums">
                      {formatPercent(section.attendanceRate)}
                    </span>
                    {section.atRiskCount > 0 ? (
                      <Badge tone="danger">{`เสี่ยง ${formatNumber(section.atRiskCount)} คน`}</Badge>
                    ) : null}
                  </span>
                  <ChevronRightIcon size={20} className="shrink-0 text-on-surface-variant group-hover:text-primary-container" />
                </Link>
              </li>
            ))}
          </ul>
          {sections.meta && sections.meta.totalPages > 1 ? (
            <div className="px-4 pb-4 md:px-6 md:pb-6">
              <Pagination
                page={sections.meta.page}
                totalPages={sections.meta.totalPages}
                total={sections.meta.total}
                hrefFor={(target) => `/stats?page=${target}`}
              />
            </div>
          ) : null}
        </Card>
      )}
    </>
  );
}
