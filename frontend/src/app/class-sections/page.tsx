import type { Metadata } from "next";
import Link from "next/link";
import {
  Alert,
  BookOpenIcon,
  ChevronRightIcon,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  EmptyState,
  PageHeaderBar,
  Pagination,
  PlusIcon,
  SearchIcon,
  TextInput,
  formatTerm,
} from "@/components/shared/kit";
import { ApiErrorView } from "@/components/shared/api-error-view";
import { apiGet, getMe } from "@/lib/api-server";
import { can } from "@/lib/permissions";
import { firstParam, pageParam } from "@/lib/search-params";
import type { AttendanceSession, ClassSection } from "@/lib/types";

export const metadata: Metadata = { title: "กลุ่มเรียน" };

export default async function ClassSectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await getMe();
  if (!me.ok) {
    return null;
  }
  const role = me.data.subsystemRole;
  if (!can(role, "class-section:read")) {
    return <ApiErrorView error={{ code: "FORBIDDEN", message: "" }} retryHref="/class-sections" />;
  }

  const params = await searchParams;
  const page = pageParam(params.page);
  const q = (firstParam(params.q) ?? "").trim().slice(0, 100);
  // Staff mostly work with their own sections; ADMIN sees everything by default.
  // The form always sends a hidden mine=0; a checked box adds mine=1.
  const mineParam = params.mine;
  const mine =
    mineParam === undefined
      ? !can(role, "class-section:update:any")
      : Array.isArray(mineParam)
        ? mineParam.includes("1")
        : mineParam === "1";

  const query = new URLSearchParams({ page: String(page), limit: "20", mine: String(mine) });
  if (q) {
    query.set("q", q);
  }
  const [result, openSessions] = await Promise.all([
    apiGet<ClassSection[]>(`/api/v1/class-sections?${query}`),
    apiGet<AttendanceSession[]>("/api/v1/attendance-sessions?status=OPEN&limit=100"),
  ]);
  const liveIds = new Set(openSessions.ok ? openSessions.data.map((session) => session.classSectionId) : []);

  const hrefFor = (target: number) => {
    const next = new URLSearchParams({ page: String(target), mine: mine ? "1" : "0" });
    if (q) {
      next.set("q", q);
    }
    return `/class-sections?${next}`;
  };
  const filtered = q !== "" || mine !== !can(role, "class-section:update:any");

  return (
    <>
      <PageHeaderBar
        title="กลุ่มเรียน"
        description="กลุ่มเรียนที่ใช้เช็คชื่อ เปิดรอบเช็คชื่อได้จากหน้ารายละเอียดของกลุ่มเรียน"
        actions={
          can(role, "class-section:create") ? (
            <ButtonLink href="/class-sections/new">
              <PlusIcon size={16} />
              เพิ่มกลุ่มเรียน
            </ButtonLink>
          ) : null
        }
      />

      {params.deleted === "1" ? <Alert tone="success" title="ลบกลุ่มเรียนแล้ว" /> : null}

      <Card>
        <form method="get" className="flex flex-col gap-4 md:flex-row md:items-end" role="search">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="q" className="font-semibold text-on-surface">
              ค้นหา
            </label>
            <TextInput id="q" name="q" type="search" defaultValue={q} placeholder="รหัสวิชาหรือชื่อวิชา" />
          </div>
          <input type="hidden" name="mine" value="0" />
          <Checkbox name="mine" value="1" defaultChecked={mine} label="เฉพาะกลุ่มเรียนของฉัน" />
          <Button type="submit" variant="secondary">
            <SearchIcon size={16} />
            ค้นหา
          </Button>
        </form>
      </Card>

      {!result.ok ? (
        <ApiErrorView error={result.error} retryHref={hrefFor(page)} />
      ) : result.data.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState
              icon={SearchIcon}
              title="ไม่พบกลุ่มเรียนที่ตรงกับการค้นหา"
              description="ลองเปลี่ยนคำค้นหา หรือแสดงกลุ่มเรียนทั้งหมด"
              action={
                <ButtonLink href="/class-sections?mine=0" variant="secondary">
                  ล้างตัวกรอง
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={BookOpenIcon}
              title="ยังไม่มีกลุ่มเรียน"
              description="เพิ่มกลุ่มเรียนพร้อมจุดเช็คชื่อของห้องเรียน แล้วเปิดรอบเช็คชื่อได้ทันที"
              action={
                can(role, "class-section:create") ? (
                  <ButtonLink href="/class-sections/new">เพิ่มกลุ่มเรียน</ButtonLink>
                ) : undefined
              }
            />
          )}
        </Card>
      ) : (
        <Card flush className="flex flex-col gap-6">
          <ClassSectionTable sections={result.data} liveIds={liveIds} />
          {result.meta && result.meta.totalPages > 1 ? (
            <div className="px-4 pb-4 md:px-6 md:pb-6">
              <Pagination
                page={result.meta.page}
                totalPages={result.meta.totalPages}
                total={result.meta.total}
                hrefFor={hrefFor}
              />
            </div>
          ) : null}
        </Card>
      )}
    </>
  );
}

/** Small "session open" marker - dot plus text, never colour alone. */
function LiveMarker() {
  return (
    <span className="inline-flex items-center gap-1 text-sm/relaxed font-semibold text-emerald-700">
      <span aria-hidden className="size-2 rounded-full bg-success" />
      เปิดรอบอยู่
    </span>
  );
}

function ClassSectionTable({ sections, liveIds }: { sections: ClassSection[]; liveIds: Set<string> }) {
  return (
    <>
      {/* Mobile: one tappable row per section (section 6.2). */}
      <ul className="flex flex-col divide-y divide-outline-variant/40 md:hidden">
        {sections.map((section) => (
          <li key={section.id}>
            <Link
              href={`/class-sections/${section.id}`}
              className="group flex items-center gap-3 p-4 transition-colors duration-150 hover:bg-primary-container/10"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm/relaxed text-on-surface-variant">{section.courseCode}</span>
                  {liveIds.has(section.id) ? <LiveMarker /> : null}
                </span>
                <span className="font-semibold text-on-surface">{section.courseName}</span>
                <span className="text-sm/relaxed text-on-surface-variant">
                  กลุ่ม {section.sectionCode} · {formatTerm(section.term, section.academicYear)}
                </span>
              </span>
              <ChevronRightIcon size={20} className="shrink-0 text-on-surface-variant group-hover:text-primary-container" />
            </Link>
          </li>
        ))}
      </ul>

      {/* w-0 + min-w-full: a long row scrolls inside this box instead of widening the shell's main column. */}
      <div className="relative hidden w-0 min-w-full overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead className="bg-surface-container-low text-sm/relaxed font-semibold text-on-surface">
            <tr>
              <th scope="col" className="px-6 py-3">รหัสวิชา</th>
              <th scope="col" className="px-6 py-3">ชื่อวิชา</th>
              <th scope="col" className="px-6 py-3">กลุ่ม</th>
              <th scope="col" className="px-6 py-3">ภาคเรียน</th>
              <th scope="col" className="px-6 py-3">สถานะ</th>
              <th scope="col" className="px-6 py-3 text-right">
                <span className="sr-only">จัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {sections.map((section) => (
              <tr key={section.id} className="h-14 transition-colors duration-150 hover:bg-primary-container/10">
                <td className="px-6 font-mono text-sm/relaxed text-on-surface">{section.courseCode}</td>
                <td className="px-6 font-semibold text-on-surface">{section.courseName}</td>
                <td className="px-6 tabular-nums">{section.sectionCode}</td>
                <td className="px-6 tabular-nums">{formatTerm(section.term, section.academicYear)}</td>
                <td className="px-6">
                  {liveIds.has(section.id) ? (
                    <LiveMarker />
                  ) : (
                    <span className="text-on-surface-variant">
                      <span aria-hidden>–</span>
                      <span className="sr-only">ไม่มีรอบที่เปิดอยู่</span>
                    </span>
                  )}
                </td>
                <td className="px-6 text-right">
                  <Link
                    href={`/class-sections/${section.id}`}
                    className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary-container hover:underline"
                  >
                    ดูรายละเอียด
                    <ChevronRightIcon size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
