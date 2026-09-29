import {
  ButtonLink,
  Card,
  CheckCircleIcon,
  EmptyState,
  ErrorState,
  KeyRoundIcon,
  MapPinIcon,
  PresentationIcon,
  ShieldOffIcon,
} from "@csmju2030/design-system";
import { PORTAL_URL, SIGN_IN_URL } from "@/lib/config";
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
          <span aria-hidden className="flex size-14 items-center justify-center rounded-lg bg-primary text-inverse">
            <MapPinIcon size={32} />
          </span>
          <h1 className="font-heading text-2xl font-semibold text-ink md:text-3xl">ระบบเช็คชื่อเข้าเรียน</h1>
          <p className="max-w-prose text-body">
            เช็คชื่อด้วยรหัสที่อาจารย์แสดงในห้องเรียน ระบบยืนยันว่าคุณอยู่ในห้องจากตำแหน่งของอุปกรณ์
            เข้าสู่ระบบด้วยบัญชีของมหาวิทยาลัยผ่าน Core Hub
          </p>
          <ButtonLink href={SIGN_IN_URL} size="lg" className="mt-2 w-full sm:w-auto">
            เข้าสู่ระบบผ่าน Core Hub
          </ButtonLink>
        </Card>

        <section aria-labelledby="how-it-works" className="flex flex-col gap-4">
          <h2 id="how-it-works" className="font-heading text-xl font-semibold text-ink">
            ใช้งานอย่างไร
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step.title} className="flex gap-3 rounded-lg border border-line bg-surface p-4">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  {step.icon}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">
                    {index + 1}. {step.title}
                  </span>
                  <span className="text-sm text-body">{step.detail}</span>
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
          <ButtonLink href={PORTAL_URL} variant="secondary">
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
