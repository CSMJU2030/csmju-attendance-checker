import type { Metadata } from "next";
import { ButtonLink, Card, EmptyState, HistoryIcon, PageHeader, Pagination } from "@csmju2030/design-system";
import { AttendanceRecordList } from "@/components/features/attendance-record-list";
import { ApiErrorView } from "@/components/shared/api-error-view";
import { apiGet, getMe } from "@/lib/api-server";
import { can } from "@/lib/permissions";
import { pageParam } from "@/lib/search-params";
import type { AttendanceRecordView } from "@/lib/types";

export const metadata: Metadata = { title: "ประวัติการเช็คชื่อ" };

export default async function AttendanceRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await getMe();
  if (!me.ok) {
    return null;
  }
  if (!can(me.data.subsystemRole, "attendance-record:read:own")) {
    return <ApiErrorView error={{ code: "FORBIDDEN", message: "" }} retryHref="/attendance-records" />;
  }

  const page = pageParam((await searchParams).page);
  const result = await apiGet<AttendanceRecordView[]>(`/api/v1/attendance-records/me?page=${page}&limit=20`);

  return (
    <>
      <PageHeader title="ประวัติการเช็คชื่อ" description="การเช็คชื่อทั้งหมดของคุณ เรียงจากล่าสุด" />
      {!result.ok ? (
        <ApiErrorView error={result.error} retryHref={`/attendance-records?page=${page}`} />
      ) : result.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={HistoryIcon}
            title="ยังไม่มีประวัติการเช็คชื่อ"
            description="เมื่อคุณเช็คชื่อเข้าเรียน รายการจะแสดงที่นี่"
            action={<ButtonLink href="/check-in">เช็คชื่อ</ButtonLink>}
          />
        </Card>
      ) : (
        <Card className="flex flex-col gap-6">
          <AttendanceRecordList records={result.data} />
          {result.meta ? (
            <Pagination
              page={result.meta.page}
              totalPages={result.meta.totalPages}
              total={result.meta.total}
              hrefFor={(target) => `/attendance-records?page=${target}`}
            />
          ) : null}
        </Card>
      )}
    </>
  );
}
