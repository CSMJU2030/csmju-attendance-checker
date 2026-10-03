import type { Metadata } from "next";
import Link from "next/link";
import {
  Alert,
  ButtonLink,
  Card,
  CardTitle,
  ChevronRightIcon,
  ClockIcon,
  EmptyState,
  ExternalLinkIcon,
  HistoryIcon,
  MapPinIcon,
  PageHeaderBar,
  PencilIcon,
  PresentationIcon,
  StatCard,
  UsersIcon,
  formatDate,
  formatNumber,
  formatTerm,
  formatTime,
} from "@/components/shared/kit";
import { DeleteSectionCard, OpenSessionAction } from "@/components/features/section-actions";
import { SessionStatusBadge } from "@/components/features/session-status";
import { ApiErrorView } from "@/components/shared/api-error-view";
import { apiGet, getMe } from "@/lib/api-server";
import { canManageSection } from "@/lib/permissions";
import type { AttendanceSession, ClassSection } from "@/lib/types";

export const metadata: Metadata = { title: "รายละเอียดกลุ่มเรียน" };

export default async function ClassSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const me = await getMe();
  if (!me.ok) {
    return null;
  }

  const result = await apiGet<ClassSection>(`/api/v1/class-sections/${encodeURIComponent(id)}`);
  if (!result.ok) {
    return <ApiErrorView error={result.error} retryHref={`/class-sections/${id}`} backHref="/class-sections" />;
  }
  const section = result.data;
  const canManage = canManageSection(me.data, section.ownerCoreUserId, "manage");
  const canEdit = canManageSection(me.data, section.ownerCoreUserId, "update");

  const sessions = canManage
    ? await apiGet<AttendanceSession[]>(`/api/v1/attendance-sessions?classSectionId=${section.id}&limit=50`)
    : null;
  const sessionList = sessions?.ok ? sessions.data : [];
  const sessionTotal = sessions?.ok ? (sessions.meta?.total ?? sessionList.length) : 0;
  const openSession = sessionList.find((session) => session.status === "OPEN") ?? null;
  const closed = sessionList.filter((session) => session.status === "CLOSED");
  const averageAttendance =
    closed.length > 0 ? Math.round(closed.reduce((sum, session) => sum + session.recordCount, 0) / closed.length) : null;
  const label = `${section.courseCode} ${section.courseName} กลุ่ม ${section.sectionCode}`;
  const mapUrl = `https://www.google.com/maps?q=${section.latitude},${section.longitude}`;

  return (
    <>
      <PageHeaderBar
        title={`${section.courseCode} ${section.courseName}`}
        description={`กลุ่ม ${section.sectionCode} · ${formatTerm(section.term, section.academicYear)}`}
        back={{ href: "/class-sections", label: "กลุ่มเรียน" }}
        actions={
          <>
            {canEdit ? (
              <ButtonLink href={`/class-sections/${section.id}/edit`} variant="secondary">
                <PencilIcon size={16} />
                แก้ไข
              </ButtonLink>
            ) : null}
            {canManage ? <OpenSessionAction sectionId={section.id} openSessionId={openSession?.id ?? null} /> : null}
          </>
        }
      />

      {saved === "1" ? <Alert tone="success" title="บันทึกกลุ่มเรียนแล้ว" /> : null}

      {canManage && sessions?.ok ? (
        <section aria-label="สรุปกลุ่มเรียน" className="grid gap-4 sm:grid-cols-3">
          <StatCard label="รอบเช็คชื่อทั้งหมด" value={formatNumber(sessionTotal)} unit="รอบ" icon={<PresentationIcon />} />
          <StatCard
            label="เฉลี่ยต่อรอบ"
            value={averageAttendance === null ? "-" : formatNumber(averageAttendance)}
            unit={averageAttendance === null ? undefined : "คน"}
            hint={averageAttendance === null ? "ยังไม่มีรอบที่ปิดแล้ว" : `จาก ${closed.length} รอบที่ปิดแล้ว`}
            icon={<UsersIcon />}
            tone="neutral"
          />
          <StatCard
            label="นับว่าสายหลังเปิดรอบ"
            value={formatNumber(section.lateAfterMinutes)}
            unit="นาที"
            icon={<ClockIcon />}
            tone="warning"
          />
        </section>
      ) : null}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>จุดเช็คชื่อ</CardTitle>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-sm/relaxed font-semibold text-primary-container hover:underline"
          >
            ดูบนแผนที่
            <ExternalLinkIcon size={16} />
            <span className="sr-only">(เปิดในแท็บใหม่)</span>
          </a>
        </div>
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-container/10 text-primary-container">
            <MapPinIcon />
          </span>
          <p className="text-on-surface-variant">
            นักศึกษาต้องอยู่ภายใน <span className="font-semibold text-on-surface tabular-nums">{section.radiusMeters} เมตร</span> จากจุด{" "}
            <span className="font-mono text-sm/relaxed text-on-surface tabular-nums">
              {section.latitude.toFixed(6)}, {section.longitude.toFixed(6)}
            </span>{" "}
            และเช็คชื่อหลังเปิดรอบเกิน{" "}
            <span className="font-semibold text-on-surface tabular-nums">{section.lateAfterMinutes} นาที</span> จะนับว่ามาสาย
          </p>
        </div>
      </Card>

      {canManage ? (
        <Card flush className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 md:px-6 md:pt-6">
            <CardTitle>รอบเช็คชื่อ</CardTitle>
            <Link
              href={`/class-sections/${section.id}/records`}
              className="inline-flex min-h-11 items-center gap-1 text-sm/relaxed font-semibold text-primary-container hover:underline"
            >
              <HistoryIcon size={16} />
              ค้นหาประวัติ / ดาวน์โหลด
            </Link>
          </div>
          {sessions && !sessions.ok ? (
            <ApiErrorView error={sessions.error} retryHref={`/class-sections/${section.id}`} />
          ) : sessionList.length === 0 ? (
            <EmptyState
              icon={PresentationIcon}
              title="ยังไม่เคยเปิดรอบเช็คชื่อ"
              description="กดเปิดรอบเช็คชื่อเมื่อเริ่มคาบเรียน ระบบจะแสดงรหัสให้นักศึกษากรอก"
            />
          ) : (
            <ul className="mt-2 flex flex-col divide-y divide-outline-variant/40 border-t border-outline-variant/40">
              {sessionList.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/attendance-sessions/${session.id}`}
                    className="group flex items-center gap-4 px-4 py-4 transition-colors duration-150 hover:bg-primary-container/10 md:px-6"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                      <span className="font-semibold text-on-surface tabular-nums sm:w-48">
                        {formatDate(session.openedAt)}{" "}
                        <span className="font-normal text-on-surface-variant">{formatTime(session.openedAt)}</span>
                      </span>
                      <span className="text-sm/relaxed text-on-surface-variant tabular-nums">
                        เช็คชื่อ {formatNumber(session.recordCount)} คน
                        {session.lateCount > 0 ? ` · สาย ${formatNumber(session.lateCount)} คน` : ""}
                      </span>
                    </span>
                    <SessionStatusBadge status={session.status} />
                    <ChevronRightIcon size={20} className="shrink-0 text-on-surface-variant group-hover:text-primary-container" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {canManageSection(me.data, section.ownerCoreUserId, "delete") && sessions?.ok ? (
        <DeleteSectionCard sectionId={section.id} sectionLabel={label} sessionCount={sessionTotal} />
      ) : null}
    </>
  );
}
