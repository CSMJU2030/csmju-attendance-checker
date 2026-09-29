import Link from "next/link";
import { Suspense } from "react";
import {
  BookOpenIcon,
  ButtonLink,
  Card,
  CardTitle,
  ChevronRightIcon,
  EmptyState,
  HistoryIcon,
  MapPinIcon,
  PageHeader,
  PresentationIcon,
  RoleBadge,
  StatCard,
  UsersIcon,
  formatNumber,
  formatTerm,
  formatTime,
} from "@csmju2030/design-system";
import { AttendanceRecordList } from "@/components/features/attendance-record-list";
import { ApiErrorView } from "@/components/shared/api-error-view";
import { RowsSkeleton, StatsSkeleton, SummarySkeleton } from "@/components/shared/skeletons";
import { apiGet, getMe } from "@/lib/api-server";
import { can } from "@/lib/permissions";
import type { AttendanceRecordView, AttendanceSession, AttendanceSummary, ClassSection, Me } from "@/lib/types";

export default async function OverviewPage() {
  const me = await getMe();
  if (!me.ok) {
    return null;
  }
  const role = me.data.subsystemRole;
  const staffView = can(role, "class-section:read");

  return (
    <>
      <PageHeader
        title="ภาพรวม"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <RoleBadge coreRole={me.data.coreRole} />
            <span className="break-all">{me.data.email}</span>
          </span>
        }
      />
      {staffView ? <StaffOverview me={me.data} /> : can(role, "attendance:check-in") ? <StudentOverview /> : null}
    </>
  );
}

/** Share of on-time check-ins, as a whole percentage. */
function onTimeRate(summary: AttendanceSummary): string {
  return summary.total === 0 ? "-" : `${Math.round((summary.present / summary.total) * 100)}%`;
}

/**
 * The call-to-action is static, so it renders straight away (it is the LCP
 * element); the numbers and the latest check-ins stream in behind skeletons.
 */
function StudentOverview() {
  return (
    <>
      <section
        aria-labelledby="check-in-cta"
        className="flex flex-col gap-4 rounded-lg border border-info-line bg-primary-soft p-6 md:flex-row md:items-center md:justify-between md:p-8"
      >
        <div className="flex items-start gap-4">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-md bg-primary text-inverse">
            <MapPinIcon size={24} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id="check-in-cta" className="font-heading text-xl font-semibold text-ink">
              เช็คชื่อเข้าเรียน
            </h2>
            <p className="max-w-prose text-body">
              กรอกรหัส 6 หลักที่อาจารย์แสดงในห้องเรียน แล้วระบบจะยืนยันตำแหน่งของคุณให้อัตโนมัติ
            </p>
          </div>
        </div>
        <ButtonLink href="/check-in" size="lg" className="w-full md:w-auto">
          เช็คชื่อ
        </ButtonLink>
      </section>

      <Suspense fallback={<SummarySkeleton />}>
        <StudentSummary />
      </Suspense>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>เช็คชื่อล่าสุด</CardTitle>
          <Link href="/attendance-records" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
            ดูทั้งหมด
          </Link>
        </div>
        <Suspense fallback={<RowsSkeleton rows={3} />}>
          <RecentCheckIns />
        </Suspense>
      </Card>
    </>
  );
}

async function StudentSummary() {
  const summary = await apiGet<AttendanceSummary>("/api/v1/attendance-records/me/summary");
  if (!summary.ok) {
    return null;
  }
  return (
        <Card as="section" flush aria-label="สรุปการเช็คชื่อของฉัน" className="grid grid-cols-3 divide-x divide-line">
          {[
            { label: "เช็คชื่อทั้งหมด", value: summary.data.total, tone: "text-ink", hint: "ครั้ง" },
            { label: "มาตรงเวลา", value: summary.data.present, tone: "text-success", hint: onTimeRate(summary.data) },
            { label: "มาสาย", value: summary.data.late, tone: "text-warning", hint: "ครั้ง" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1 px-2 py-4 text-center md:py-6">
              <span className={`font-heading text-2xl font-semibold tabular-nums md:text-3xl ${stat.tone}`}>
                {formatNumber(stat.value)}
              </span>
              <span className="text-sm font-semibold text-ink">{stat.label}</span>
              <span className="text-sm text-body">{stat.hint}</span>
            </div>
          ))}
        </Card>
  );
}

async function RecentCheckIns() {
  const records = await apiGet<AttendanceRecordView[]>("/api/v1/attendance-records/me?limit=5");
  if (!records.ok) {
    return <ApiErrorView error={records.error} retryHref="/" />;
  }
  if (records.data.length === 0) {
    return <EmptyState icon={HistoryIcon} title="ยังไม่มีประวัติการเช็คชื่อ" description="เช็คชื่อครั้งแรกแล้วรายการจะแสดงที่นี่" />;
  }
  return <AttendanceRecordList records={records.data} />;
}

function StaffOverview({ me }: { me: Me }) {
  return (
    <Suspense
      fallback={
        <>
          <StatsSkeleton />
          <Card>
            <RowsSkeleton rows={2} />
          </Card>
        </>
      }
    >
      <StaffDashboard me={me} />
    </Suspense>
  );
}

async function StaffDashboard({ me }: { me: Me }) {
  const [openSessions, sections] = await Promise.all([
    apiGet<AttendanceSession[]>("/api/v1/attendance-sessions?status=OPEN&limit=20"),
    apiGet<ClassSection[]>("/api/v1/class-sections?mine=true&limit=6"),
  ]);
  const sectionById = new Map((sections.ok ? sections.data : []).map((section) => [section.id, section]));
  const open = openSessions.ok ? openSessions.data : [];
  const checkedIn = open.reduce((sum, session) => sum + session.recordCount, 0);

  return (
    <>
      <section aria-label="สรุป" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="กลุ่มเรียนของฉัน"
          value={sections.ok ? formatNumber(sections.meta?.total ?? sections.data.length) : "-"}
          unit="กลุ่ม"
          icon={<BookOpenIcon />}
        />
        <StatCard
          label="รอบเช็คชื่อที่เปิดอยู่"
          value={openSessions.ok ? formatNumber(open.length) : "-"}
          unit="รอบ"
          icon={<PresentationIcon />}
          tone={open.length > 0 ? "success" : "neutral"}
        />
        <StatCard
          label="เช็คชื่อแล้วในรอบที่เปิดอยู่"
          value={openSessions.ok ? formatNumber(checkedIn) : "-"}
          unit="คน"
          icon={<UsersIcon />}
          tone="neutral"
        />
      </section>

      <Card flush className="flex flex-col">
        <div className="px-4 pt-4 md:px-6 md:pt-6">
          <CardTitle>รอบเช็คชื่อที่เปิดอยู่</CardTitle>
        </div>
        {!openSessions.ok ? (
          <ApiErrorView error={openSessions.error} retryHref="/" />
        ) : open.length === 0 ? (
          <p className="px-4 pb-6 pt-2 text-body md:px-6">
            ยังไม่มีรอบที่เปิดอยู่ เปิดรอบใหม่ได้จากหน้ารายละเอียดของกลุ่มเรียน
          </p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-line border-t border-line">
            {open.map((session) => {
              const section = sectionById.get(session.classSectionId);
              return (
                <li key={session.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-semibold text-ink">
                      {section ? `${section.courseCode} ${section.courseName}` : "กลุ่มเรียน"}
                      {section ? <span className="font-normal text-body"> · กลุ่ม {section.sectionCode}</span> : null}
                    </p>
                    <p className="text-sm text-body tabular-nums">
                      เปิดเมื่อ {formatTime(session.openedAt)} · เช็คชื่อแล้ว {formatNumber(session.recordCount)} คน
                      {session.lateCount > 0 ? ` · สาย ${formatNumber(session.lateCount)} คน` : ""}
                    </p>
                  </div>
                  <ButtonLink href={`/attendance-sessions/${session.id}`} variant="secondary" className="w-full sm:w-auto">
                    <PresentationIcon size={16} />
                    แสดงรหัส
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>กลุ่มเรียนของฉัน</CardTitle>
          <Link href="/class-sections" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
            ดูทั้งหมด
          </Link>
        </div>
        {!sections.ok ? (
          <ApiErrorView error={sections.error} retryHref="/" />
        ) : sections.data.length === 0 ? (
          <EmptyState
            icon={BookOpenIcon}
            title="ยังไม่มีกลุ่มเรียน"
            description="เพิ่มกลุ่มเรียนพร้อมจุดเช็คชื่อของห้องเรียน แล้วเปิดรอบเช็คชื่อได้ทันที"
            action={
              can(me.subsystemRole, "class-section:create") ? (
                <ButtonLink href="/class-sections/new">เพิ่มกลุ่มเรียน</ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sections.data.map((section) => {
              const live = open.some((session) => session.classSectionId === section.id);
              return (
                <li key={section.id}>
                  <Link
                    href={`/class-sections/${section.id}`}
                    className="group flex h-full items-start justify-between gap-3 rounded-md border border-line p-4 transition-colors duration-fast hover:border-line-strong hover:bg-primary-soft"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm text-body">{section.courseCode}</span>
                        {live ? (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                            <span aria-hidden className="size-2 rounded-full bg-success" />
                            เปิดรอบอยู่
                          </span>
                        ) : null}
                      </span>
                      <span className="font-semibold text-ink">{section.courseName}</span>
                      <span className="text-sm text-body">
                        กลุ่ม {section.sectionCode} · {formatTerm(section.term, section.academicYear)}
                      </span>
                    </span>
                    <ChevronRightIcon size={20} className="mt-1 shrink-0 text-muted group-hover:text-primary" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
