import type { Metadata } from "next";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  HistoryIcon,
  PageHeaderBar,
  Pagination,
  SearchIcon,
  TextInput,
  formatDate,
  formatNumber,
  formatTerm,
  formatTime,
} from "@/components/shared/kit";
import { RecordsCsvButton } from "@/components/features/records-csv-button";
import { ApiErrorView } from "@/components/shared/api-error-view";
import { apiGet, getMe } from "@/lib/api-server";
import { canManageSection } from "@/lib/permissions";
import {
  hasFilters,
  rangeError,
  readRecordFilters,
  recordsApiQuery,
  recordsPageQuery,
} from "@/lib/record-filters";
import { pageParam } from "@/lib/search-params";
import type { AttendanceRecord, ClassSection } from "@/lib/types";

export const metadata: Metadata = { title: "ประวัติการเช็คชื่อของกลุ่มเรียน" };

const PAGE_SIZE = 20;

export default async function SectionRecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const me = await getMe();
  if (!me.ok) {
    return null;
  }

  const sectionResult = await apiGet<ClassSection>(`/api/v1/class-sections/${encodeURIComponent(id)}`);
  if (!sectionResult.ok) {
    return <ApiErrorView error={sectionResult.error} retryHref={`/class-sections/${id}/records`} backHref="/class-sections" />;
  }
  const section = sectionResult.data;
  const sectionHref = `/class-sections/${section.id}`;
  const selfHref = `${sectionHref}/records`;
  if (!canManageSection(me.data, section.ownerCoreUserId, "manage")) {
    return <ApiErrorView error={{ code: "FORBIDDEN", message: "" }} retryHref={selfHref} backHref={sectionHref} />;
  }

  const filters = readRecordFilters(query);
  const invalidRange = rangeError(filters);
  const page = pageParam(query.page);
  const result = invalidRange
    ? null
    : await apiGet<AttendanceRecord[]>(`/api/v1/attendance-records?${recordsApiQuery(section.id, filters, page, PAGE_SIZE)}`);
  const hrefFor = (target: number) => {
    const next = recordsPageQuery(filters, target);
    return next ? `${selfHref}?${next}` : selfHref;
  };
  const fileName = `attendance-${section.courseCode}-${section.sectionCode}-${section.academicYear + 543}-${section.term}${
    filters.personCode ? `-${filters.personCode}` : ""
  }${filters.from ? `-from-${filters.from}` : ""}${filters.to ? `-to-${filters.to}` : ""}.csv`;

  return (
    <>
      <PageHeaderBar
        title="ประวัติการเช็คชื่อ"
        description={`${section.courseCode} ${section.courseName} · กลุ่ม ${section.sectionCode} · ${formatTerm(section.term, section.academicYear)}`}
        back={{ href: sectionHref, label: "กลุ่มเรียน" }}
      />

      <Card>
        <form method="get" role="search" aria-label="ค้นหาประวัติการเช็คชื่อ" className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="personCode" className="font-semibold text-on-surface">
              รหัสนักศึกษา
            </label>
            <TextInput
              id="personCode"
              name="personCode"
              type="search"
              inputMode="numeric"
              maxLength={20}
              pattern="[0-9A-Za-z\-]*"
              defaultValue={filters.personCode}
              placeholder="ทั้งรหัสหรือตัวเลขต้นรหัส"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:contents">
            <div className="flex flex-col gap-2">
              <label htmlFor="from" className="font-semibold text-on-surface">
                ตั้งแต่วันที่
              </label>
              <TextInput id="from" name="from" type="date" defaultValue={filters.from} aria-invalid={invalidRange ? true : undefined} aria-describedby={invalidRange ? "range-error" : undefined} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="to" className="font-semibold text-on-surface">
                ถึงวันที่
              </label>
              <TextInput id="to" name="to" type="date" defaultValue={filters.to} aria-invalid={invalidRange ? true : undefined} aria-describedby={invalidRange ? "range-error" : undefined} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
              <SearchIcon size={16} />
              ค้นหา
            </Button>
            {hasFilters(filters) ? (
              <ButtonLink href={selfHref} variant="ghost" className="flex-1 lg:flex-none">
                ล้างตัวกรอง
              </ButtonLink>
            ) : null}
          </div>
        </form>
        {invalidRange ? (
          <p id="range-error" role="alert" className="mt-4 text-sm/relaxed text-error">
            {invalidRange}
          </p>
        ) : null}
      </Card>

      {invalidRange ? null : !result?.ok ? (
        result ? <ApiErrorView error={result.error} retryHref={hrefFor(page)} /> : null
      ) : result.data.length === 0 ? (
        <Card>
          {hasFilters(filters) ? (
            <EmptyState
              icon={SearchIcon}
              title="ไม่พบการเช็คชื่อที่ตรงกับการค้นหา"
              description="ลองเปลี่ยนรหัสนักศึกษาหรือช่วงวันที่"
              action={
                <ButtonLink href={selfHref} variant="secondary">
                  ล้างตัวกรอง
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={HistoryIcon}
              title="ยังไม่มีการเช็คชื่อในกลุ่มเรียนนี้"
              description="เมื่อนักศึกษาเช็คชื่อในรอบของกลุ่มเรียนนี้ ประวัติจะแสดงที่นี่"
            />
          )}
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-on-surface-variant tabular-nums" role="status">
              พบ <span className="font-semibold text-on-surface">{formatNumber(result.meta?.total ?? result.data.length)}</span> รายการ
            </p>
            <RecordsCsvButton sectionId={section.id} filters={filters} fileName={fileName} />
          </div>
          {result.meta && result.meta.totalPages > 1 ? (
            <Alert tone="info">ไฟล์ CSV จะมีทุกรายการที่ตรงกับการค้นหานี้ ไม่ใช่เฉพาะหน้าที่เห็น</Alert>
          ) : null}
          <Card flush className="flex flex-col gap-6">
            <RecordTable records={result.data} />
            {result.meta && result.meta.totalPages > 1 ? (
              <div className="px-4 pb-4 md:px-6 md:pb-6">
                <Pagination page={result.meta.page} totalPages={result.meta.totalPages} total={result.meta.total} hrefFor={hrefFor} />
              </div>
            ) : null}
          </Card>
        </>
      )}
    </>
  );
}

function PersonCode({ value }: { value: string | null }) {
  return value ? (
    <span className="font-mono text-on-surface tabular-nums">{value}</span>
  ) : (
    <span className="text-on-surface-variant">ไม่มีรหัสนักศึกษา</span>
  );
}

function RecordTable({ records }: { records: AttendanceRecord[] }) {
  return (
    <>
      <ul className="flex flex-col divide-y divide-outline-variant/40 md:hidden">
        {records.map((record) => (
          <li key={record.id} className="flex items-center gap-3 p-4">
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <PersonCode value={record.personCode} />
              <span className="text-sm/relaxed text-on-surface-variant tabular-nums">
                {formatDate(record.checkedInAt)} {formatTime(record.checkedInAt)} · ห่าง {formatNumber(record.distanceMeters)} ม.
              </span>
            </span>
          </li>
        ))}
      </ul>

      {/* w-0 + min-w-full: a long row scrolls inside this box instead of widening the shell's main column. */}
      <div className="relative hidden w-0 min-w-full overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead className="bg-surface-container-low text-sm/relaxed font-semibold text-on-surface">
            <tr>
              <th scope="col" className="px-6 py-3">วันที่</th>
              <th scope="col" className="px-6 py-3">เวลา</th>
              <th scope="col" className="px-6 py-3">รหัสนักศึกษา</th>
              <th scope="col" className="px-6 py-3 text-right">ระยะห่าง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {records.map((record) => (
              <tr key={record.id} className="h-14">
                <td className="px-6 tabular-nums">{formatDate(record.checkedInAt)}</td>
                <td className="px-6 tabular-nums">{formatTime(record.checkedInAt)}</td>
                <td className="px-6">
                  <PersonCode value={record.personCode} />
                </td>
                <td className="px-6 text-right tabular-nums">{formatNumber(record.distanceMeters)} ม.</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
