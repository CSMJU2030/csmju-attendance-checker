import { CsmjuLogo } from "@/csmju";
import {
  ButtonLink,
  Card,
  CheckCircleIcon,
  EmptyState,
  ErrorState,
  KeyRoundIcon,
  PresentationIcon,
  ShieldOffIcon,
} from "@/components/shared/kit";
import { CORE_HUB_WEB_URL, signInHref } from "@/lib/config";
import { STANDARD_MESSAGE } from "@/lib/errors";
import type { ApiError } from "@/lib/types";

const HOW_IT_WORKS = [
  { title: "อาจารย์เปิดรอบ", detail: "รหัส 6 หลักขึ้นบนจอในห้อง และเปลี่ยนทุก 2 นาที", icon: <PresentationIcon size={20} /> },
  { title: "นักศึกษากรอกรหัส", detail: "บนมือถือ แล้วอนุญาตให้ระบบใช้ตำแหน่ง", icon: <KeyRoundIcon size={20} /> },
  { title: "บันทึกทันที", detail: "มาตรงเวลาหรือมาสาย อาจารย์เห็นรายชื่อสดบนจอ", icon: <CheckCircleIcon size={20} /> },
];

/**
 * Shown instead of the page when `/api/v1/me` fails. There is deliberately no
 * login form: signing in happens at the Core Hub only (SEC-05).
 */
export function AccessGate({ status, error }: { status: number; error: ApiError }) {
  if (status === 401) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-4 md:py-8">
        <Card className="flex flex-col items-center gap-4 px-6 py-10 text-center md:px-12">
          <CsmjuLogo width={180} priority />
          <h1 className="font-display text-headline-md font-semibold text-on-surface md:text-[30px]/[1.4]">ระบบเช็คชื่อเข้าเรียน</h1>
          <p className="max-w-prose text-on-surface-variant">
            เช็คชื่อด้วยรหัสที่อาจารย์แสดงในห้องเรียน ระบบยืนยันว่าคุณอยู่ในห้องจากตำแหน่งของอุปกรณ์
            เข้าสู่ระบบด้วยบัญชีของมหาวิทยาลัยผ่าน Core Hub
          </p>
          <ButtonLink href={signInHref()} size="lg" className="mt-2 w-full sm:w-auto">
            เข้าสู่ระบบผ่าน Core Hub
          </ButtonLink>
        </Card>

        <section aria-labelledby="how-it-works" className="flex flex-col gap-4">
          <h2 id="how-it-works" className="font-display text-[20px]/[1.5] font-semibold text-on-surface">
            ใช้งานอย่างไร
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step.title} className="flex gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
                  {step.icon}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-semibold text-on-surface">
                    {index + 1}. {step.title}
                  </span>
                  <span className="text-sm/relaxed text-on-surface-variant">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    );
  }

  if (status === 403) {
    return (
      <EmptyState
        icon={ShieldOffIcon}
        title="ไม่มีสิทธิ์เข้าใช้งาน"
        description={STANDARD_MESSAGE.FORBIDDEN}
        action={
          <ButtonLink href={CORE_HUB_WEB_URL} variant="secondary">
            กลับหน้าหลัก
          </ButtonLink>
        }
      />
    );
  }

  return (
    <ErrorState
      title="เปิดระบบไม่สำเร็จ"
      description={error.code === "NETWORK_ERROR" ? STANDARD_MESSAGE.NETWORK_ERROR : STANDARD_MESSAGE.INTERNAL_ERROR}
      action={
        <ButtonLink href="/" variant="secondary">
          ลองอีกครั้ง
        </ButtonLink>
      }
    />
  );
}
