import type { Metadata } from "next";
import { PageHeaderBar, formatTerm } from "@/components/shared/kit";
import { LiveSession } from "@/components/features/live-session";
import { ApiErrorView } from "@/components/shared/api-error-view";
import { apiGet, getMe } from "@/lib/api-server";
import type { AttendanceSession, ClassSection } from "@/lib/types";

export const metadata: Metadata = { title: "รอบเช็คชื่อ" };

export default async function AttendanceSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me.ok) {
    return null;
  }

  const session = await apiGet<AttendanceSession>(`/api/v1/attendance-sessions/${encodeURIComponent(id)}`);
  if (!session.ok) {
    return <ApiErrorView error={session.error} retryHref={`/attendance-sessions/${id}`} backHref="/class-sections" />;
  }

  const section = await apiGet<ClassSection>(`/api/v1/class-sections/${session.data.classSectionId}`);
  const label = section.ok ? `${section.data.courseCode} กลุ่ม ${section.data.sectionCode}` : "กลุ่มเรียน";

  return (
    <>
      <PageHeaderBar
        title={section.ok ? `${section.data.courseCode} ${section.data.courseName}` : "รอบเช็คชื่อ"}
        description={
          section.ok
            ? `กลุ่ม ${section.data.sectionCode} · ${formatTerm(section.data.term, section.data.academicYear)}`
            : undefined
        }
        back={{ href: `/class-sections/${session.data.classSectionId}`, label: "รายละเอียดกลุ่มเรียน" }}
      />
      <LiveSession initialSession={session.data} sectionLabel={label} />
    </>
  );
}
