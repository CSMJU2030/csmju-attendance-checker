import type { Metadata } from "next";
import { PageHeader } from "@csmju2030/design-system";
import { ClassSectionForm } from "@/components/features/class-section-form";
import { ApiErrorView } from "@/components/shared/api-error-view";
import { getMe } from "@/lib/api-server";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "เพิ่มกลุ่มเรียน" };

export default async function NewClassSectionPage() {
  const me = await getMe();
  if (!me.ok) {
    return null;
  }
  if (!can(me.data.subsystemRole, "class-section:create")) {
    return <ApiErrorView error={{ code: "FORBIDDEN", message: "" }} retryHref="/class-sections" />;
  }

  return (
    <>
      <PageHeader
        title="เพิ่มกลุ่มเรียน"
        description="คุณจะเป็นผู้สอนของกลุ่มเรียนนี้ และเปิดรอบเช็คชื่อได้ทันทีหลังบันทึก"
        back={{ href: "/class-sections", label: "กลุ่มเรียน" }}
      />
      <div className="w-full max-w-3xl">
        <ClassSectionForm />
      </div>
    </>
  );
}
