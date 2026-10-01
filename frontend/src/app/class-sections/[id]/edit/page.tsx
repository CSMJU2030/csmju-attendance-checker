import type { Metadata } from "next";
import { PageHeaderBar } from "@/components/shared/kit";
import { ClassSectionForm } from "@/components/features/class-section-form";
import { ApiErrorView } from "@/components/shared/api-error-view";
import { apiGet, getMe } from "@/lib/api-server";
import { canManageSection } from "@/lib/permissions";
import type { ClassSection } from "@/lib/types";

export const metadata: Metadata = { title: "แก้ไขกลุ่มเรียน" };

export default async function EditClassSectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me.ok) {
    return null;
  }

  const result = await apiGet<ClassSection>(`/api/v1/class-sections/${encodeURIComponent(id)}`);
  if (!result.ok) {
    return <ApiErrorView error={result.error} retryHref={`/class-sections/${id}/edit`} backHref="/class-sections" />;
  }
  const section = result.data;
  if (!canManageSection(me.data, section.ownerCoreUserId, "update")) {
    return <ApiErrorView error={{ code: "FORBIDDEN", message: "" }} retryHref={`/class-sections/${id}`} />;
  }

  return (
    <>
      <PageHeaderBar
        title="แก้ไขกลุ่มเรียน"
        description={`${section.courseCode} ${section.courseName} กลุ่ม ${section.sectionCode}`}
        back={{ href: `/class-sections/${section.id}`, label: "รายละเอียดกลุ่มเรียน" }}
      />
      <div className="w-full max-w-3xl">
        <ClassSectionForm section={section} />
      </div>
    </>
  );
}
