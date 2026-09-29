import Link from "next/link";
import {
  Badge,
  BookOpenIcon,
  ButtonLink,
  Card,
  CardTitle,
  EmptyState,
  HistoryIcon,
  MapPinIcon,
  PageHeader,
  RoleBadge,
  formatDateTime,
  formatTerm,
} from "@csmju2030/design-system";
import { AttendanceRecordList } from "@/components/features/attendance-record-list";
import { ApiErrorView } from "@/components/shared/api-error-view";
import { apiGet, getMe } from "@/lib/api-server";
import { can } from "@/lib/permissions";
import type { AttendanceRecordView, AttendanceSession, ClassSection, Me } from "@/lib/types";

export default async function OverviewPage() {
  const me = await getMe();
  if (!me.ok) {
    return null;
  }
  const role = me.data.subsystemRole;

  return (
    <>
      <PageHeader
        title="ภาพรวม"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <RoleBadge coreRole={me.data.coreRole} />
            <span>{me.data.email}</span>
          </span>
        }
      />
      {can(role, "attendance:check-in") && !can(role, "class-section:read") ? <StudentOverview /> : null}
      {can(role, "class-section:read") ? <StaffOverview me={me.data} /> : null}
    </>
  );
}

async function StudentOverview() {
  const records = await apiGet<AttendanceRecordView[]>("/api/v1/attendance-records/me?limit=5");

  return (
    <>
      <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="text-primary">
            <MapPinIcon size={32} />
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle>เช็คชื่อเข้าเรียน</CardTitle>
            <p className="text-body">กรอกรหัส 6 หลักที่อาจารย์แสดงในห้องเรียน ระบบจะตรวจตำแหน่งของคุณอัตโนมัติ</p>
          </div>
        </div>
        <ButtonLink href="/check-in" size="lg" className="w-full md:w-auto">
          เช็คชื่อ
        </ButtonLink>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>เช็คชื่อล่าสุด</CardTitle>
          <Link href="/attendance-records" className="text-sm font-medium text-primary hover:underline">
            ดูทั้งหมด
          </Link>
        </div>
        {!records.ok ? (
          <ApiErrorView error={records.error} retryHref="/" />
        ) : records.data.length === 0 ? (
          <EmptyState icon={HistoryIcon} title="ยังไม่มีประวัติการเช็คชื่อ" description="เช็คชื่อครั้งแรกแล้วรายการจะแสดงที่นี่" />
        ) : (
          <AttendanceRecordList records={records.data} />
        )}
      </Card>
    </>
  );
}

async function StaffOverview({ me }: { me: Me }) {
  const [openSessions, sections] = await Promise.all([
    apiGet<AttendanceSession[]>("/api/v1/attendance-sessions?status=OPEN&limit=20"),
    apiGet<ClassSection[]>("/api/v1/class-sections?mine=true&limit=6"),
  ]);
  const sectionById = new Map((sections.ok ? sections.data : []).map((section) => [section.id, section]));

  return (
    <>
      <Card className="flex flex-col gap-4">
        <CardTitle>รอบเช็คชื่อที่เปิดอยู่</CardTitle>
        {!openSessions.ok ? (
          <ApiErrorView error={openSessions.error} retryHref="/" />
        ) : openSessions.data.length === 0 ? (
          <p className="text-body">ไม่มีรอบเช็คชื่อที่เปิดอยู่ เปิดรอบใหม่ได้จากหน้ารายละเอียดของกลุ่มเรียน</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {openSessions.data.map((session) => {
              const section = sectionById.get(session.classSectionId);
              return (
                <li key={session.id}>
                  <Link
                    href={`/attendance-sessions/${session.id}`}
                    className="flex flex-col gap-1 py-3 hover:bg-primary-soft sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium text-ink">
                      {section ? `${section.courseCode} ${section.courseName} กลุ่ม ${section.sectionCode}` : "กลุ่มเรียน"}
                    </span>
                    <span className="flex items-center gap-2 text-sm text-muted tabular-nums">
                      เปิดเมื่อ {formatDateTime(session.openedAt)}
                      <Badge tone="success">เปิดอยู่</Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>กลุ่มเรียนของฉัน</CardTitle>
          <Link href="/class-sections" className="text-sm font-medium text-primary hover:underline">
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
            {sections.data.map((section) => (
              <li key={section.id}>
                <Link
                  href={`/class-sections/${section.id}`}
                  className="flex h-full flex-col gap-1 rounded-md border border-line p-4 hover:border-line-strong hover:bg-primary-soft"
                >
                  <span className="font-mono text-sm text-muted">{section.courseCode}</span>
                  <span className="font-medium text-ink">{section.courseName}</span>
                  <span className="text-sm text-muted">
                    กลุ่ม {section.sectionCode} · {formatTerm(section.term, section.academicYear)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
