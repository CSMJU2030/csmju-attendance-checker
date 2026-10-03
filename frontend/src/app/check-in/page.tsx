import type { Metadata } from "next";
import { PageHeaderBar } from "@/components/shared/kit";
import { CheckInForm } from "@/components/features/check-in-form";
import { ApiErrorView } from "@/components/shared/api-error-view";
import { getMe } from "@/lib/api-server";
import { can } from "@/lib/permissions";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "เช็คชื่อ" };

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await getMe();
  if (!me.ok) {
    return null;
  }
  if (!can(me.data.subsystemRole, "attendance:check-in")) {
    return <ApiErrorView error={{ code: "FORBIDDEN", message: "" }} retryHref="/check-in" />;
  }

  // The classroom QR links here with ?code=; anything but 6 digits is ignored.
  const qrCode = firstParam((await searchParams).code) ?? "";

  return (
    <>
      <PageHeaderBar
        title="เช็คชื่อเข้าเรียน"
        description="กรอกรหัสที่อาจารย์แสดงในห้องเรียน แล้วอนุญาตให้ระบบใช้ตำแหน่งของอุปกรณ์"
      />
      <div className="w-full max-w-xl">
        <CheckInForm initialCode={/^\d{6}$/.test(qrCode) ? qrCode : ""} />
      </div>
    </>
  );
}
