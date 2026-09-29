import type { Metadata } from "next";
import Link from "next/link";
import {
  Alert,
  Card,
  CardTitle,
  DescriptionList,
  EmptyState,
  MapPinIcon,
  PageHeader,
  formatDateTime,
  formatTerm,
} from "@csmju2030/design-system";
import { SectionActions } from "@/components/features/section-actions";
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

  const sessions = canManage
    ? await apiGet<AttendanceSession[]>(`/api/v1/attendance-sessions?classSectionId=${section.id}&limit=50`)
    : null;
  const sessionList = sessions?.ok ? sessions.data : [];
  const openSession = sessionList.find((session) => session.status === "OPEN") ?? null;
  const label = `${section.courseCode} ${section.courseName} กลุ่ม ${section.sectionCode}`;

  return (
    <>
      <PageHeader
        title={`${section.courseCode} ${section.courseName}`}
        description={`กลุ่ม ${section.sectionCode} · ${formatTerm(section.term, section.academicYear)}`}
        back={{ href: "/class-sections", label: "กลุ่มเรียน" }}
      />

      {saved === "1" ? <Alert tone="success" title="บันทึกกลุ่มเรียนแล้ว" /> : null}

      <SectionActions
        sectionId={section.id}
        sectionLabel={label}
        openSessionId={openSession?.id ?? null}
        sessionCount={sessions?.ok ? (sessions.meta?.total ?? sessionList.length) : 0}
        canOpen={canManage}
        canEdit={canManageSection(me.data, section.ownerCoreUserId, "update")}
        canDelete={canManageSection(me.data, section.ownerCoreUserId, "delete") && sessions?.ok === true}
      />

      <Card className="flex flex-col gap-4">
        <CardTitle>กติกาการเช็คชื่อ</CardTitle>
        <DescriptionList
          items={[
            { term: "รัศมีเช็คชื่อ", value: <span className="tabular-nums">{section.radiusMeters} เมตร</span> },
            {
              term: "นับว่าสาย",
              value: <span className="tabular-nums">เมื่อเช็คชื่อหลังเปิดรอบเกิน {section.lateAfterMinutes} นาที</span>,
            },
            {
              term: "จุดเช็คชื่อ (ละติจูด, ลองจิจูด)",
              value: (
                <span className="font-mono text-sm tabular-nums">
                  {section.latitude.toFixed(6)}, {section.longitude.toFixed(6)}
                </span>
              ),
            },
          ]}
        />
      </Card>

      {canManage ? (
        <Card flush className="flex flex-col gap-4">
          <div className="px-4 pt-4 md:px-6 md:pt-6">
            <CardTitle>รอบเช็คชื่อ</CardTitle>
          </div>
          {sessions && !sessions.ok ? (
            <ApiErrorView error={sessions.error} retryHref={`/class-sections/${section.id}`} />
          ) : sessionList.length === 0 ? (
            <EmptyState
              icon={MapPinIcon}
              title="ยังไม่เคยเปิดรอบเช็คชื่อ"
              description="กดเปิดรอบเช็คชื่อเมื่อเริ่มคาบเรียน ระบบจะแสดงรหัสให้นักศึกษากรอก"
            />
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {sessionList.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/attendance-sessions/${session.id}`}
                    className="flex flex-col gap-1 px-4 py-3 hover:bg-primary-soft sm:flex-row sm:items-center sm:justify-between md:px-6"
                  >
                    <span className="text-ink tabular-nums">เปิดเมื่อ {formatDateTime(session.openedAt)}</span>
                    <SessionStatusBadge status={session.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </>
  );
}
