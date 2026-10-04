import type { Metadata } from "next";
import {
  Button,
  ButtonLink,
  Card,
  CardTitle,
  EmptyState,
  PageHeaderBar,
  Pagination,
  SearchIcon,
  TextInput,
  UsersIcon,
  formatDate,
  formatNumber,
  formatTerm,
} from "@/components/shared/kit";
import { RosterAdd } from "@/components/features/roster-add";
import { RosterRemoveButton } from "@/components/features/roster-remove-button";
import { ApiErrorView } from "@/components/shared/api-error-view";
import { apiGet, getMe } from "@/lib/api-server";
import { can, canManageSection } from "@/lib/permissions";
import { firstParam, pageParam } from "@/lib/search-params";
import type { ClassSection, RosterStudent } from "@/lib/types";

export const metadata: Metadata = { title: "รายชื่อนักศึกษาในกลุ่มเรียน" };

const PAGE_SIZE = 50;

export default async function SectionStudentsPage({
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
    return <ApiErrorView error={sectionResult.error} retryHref={`/class-sections/${id}/students`} backHref="/class-sections" />;
  }
  const section = sectionResult.data;
  const sectionHref = `/class-sections/${section.id}`;
  const selfHref = `${sectionHref}/students`;
  if (!canManageSection(me.data, section.ownerCoreUserId, "update")) {
    return <ApiErrorView error={{ code: "FORBIDDEN", message: "" }} retryHref={selfHref} backHref={sectionHref} />;
  }

  const q = (firstParam(query.q) ?? "").trim();
  const search = /^[0-9A-Za-z-]{1,20}$/.test(q) ? q : "";
  const page = pageParam(query.page);
  const apiQuery = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (search) apiQuery.set("q", search);
  const roster = await apiGet<RosterStudent[]>(`/api/v1/class-sections/${section.id}/students?${apiQuery}`);
  const hrefFor = (target: number) => {
    const next = new URLSearchParams({ page: String(target) });
    if (search) next.set("q", search);
    return `${selfHref}?${next}`;
  };

  return (
    <>
      <PageHeaderBar
        title="รายชื่อนักศึกษา"
        description={`${section.courseCode} ${section.courseName} · กลุ่ม ${section.sectionCode} · ${formatTerm(section.term, section.academicYear)}`}
        back={{ href: sectionHref, label: "กลุ่มเรียน" }}
      />

      <p className="max-w-prose text-on-surface-variant">
        Core Hub ไม่มีข้อมูลการลงทะเบียนเรียน อาจารย์จึงกำหนดรายชื่อนักศึกษาของกลุ่มเรียนเองที่นี่
        นักศึกษาที่ไม่อยู่ในรายชื่อยังเช็คชื่อได้ แต่จะขึ้นป้าย &quot;ไม่อยู่ในรายชื่อ&quot; ให้อาจารย์เห็น
      </p>

      <RosterAdd sectionId={section.id} canSearchPeople={can(me.data.subsystemRole, "people:search")} />

      <Card flush className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 px-4 pt-4 md:flex-row md:items-end md:justify-between md:px-6 md:pt-6">
          <CardTitle>
            ในรายชื่อ{" "}
            <span className="font-normal text-on-surface-variant tabular-nums">
              {roster.ok ? `${formatNumber(roster.meta?.total ?? roster.data.length)} คน` : ""}
            </span>
          </CardTitle>
          <form method="get" role="search" aria-label="ค้นหาในรายชื่อ" className="flex gap-2">
            <label htmlFor="roster-q" className="sr-only">
              ค้นหารหัสนักศึกษา
            </label>
            <TextInput id="roster-q" name="q" type="search" inputMode="numeric" defaultValue={search} placeholder="รหัสนักศึกษา" className="w-44" />
            <Button type="submit" variant="secondary">
              <SearchIcon size={16} />
              <span className="sr-only sm:not-sr-only">ค้นหา</span>
            </Button>
          </form>
        </div>

        {!roster.ok ? (
          <div className="px-4 pb-4 md:px-6 md:pb-6">
            <ApiErrorView error={roster.error} retryHref={hrefFor(page)} />
          </div>
        ) : roster.data.length === 0 ? (
          search ? (
            <EmptyState
              icon={SearchIcon}
              title="ไม่พบรหัสนี้ในรายชื่อ"
              description="ลองพิมพ์รหัสให้น้อยลง หรือดูรายชื่อทั้งหมด"
              action={
                <ButtonLink href={selfHref} variant="secondary">
                  ดูรายชื่อทั้งหมด
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={UsersIcon}
              title="ยังไม่มีรายชื่อนักศึกษา"
              description="เพิ่มรหัสนักศึกษาด้านบน เมื่อมีรายชื่อแล้ว ระบบจะติดป้ายคนที่เช็คชื่อแต่ไม่อยู่ในรายชื่อ"
            />
          )
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-outline-variant/40 border-t border-outline-variant/40">
              {roster.data.map((student) => (
                <li key={student.personCode} className="flex items-center gap-3 px-4 py-2 md:px-6">
                  <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-4">
                    <span className="font-mono font-semibold text-on-surface tabular-nums">{student.personCode}</span>
                    <span className="text-sm/relaxed text-on-surface-variant">เพิ่มเมื่อ {formatDate(student.addedAt)}</span>
                  </span>
                  <RosterRemoveButton sectionId={section.id} personCode={student.personCode} />
                </li>
              ))}
            </ul>
            {roster.meta && roster.meta.totalPages > 1 ? (
              <div className="px-4 pb-4 md:px-6 md:pb-6">
                <Pagination page={roster.meta.page} totalPages={roster.meta.totalPages} total={roster.meta.total} hrefFor={hrefFor} />
              </div>
            ) : (
              <div className="pb-2" />
            )}
          </>
        )}
      </Card>
    </>
  );
}
