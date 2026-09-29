import { ButtonLink, Card, EmptyState, ErrorState, ShieldOffIcon } from "@csmju2030/design-system";
import { PORTAL_URL, SIGN_IN_URL } from "@/lib/config";
import { STANDARD_MESSAGE } from "@/lib/errors";
import type { ApiError } from "@/lib/types";

/**
 * Shown instead of the page when `/api/v1/me` fails. There is deliberately no
 * login form: signing in happens at the Core Hub only (SEC-05).
 */
export function AccessGate({ status, error }: { status: number; error: ApiError }) {
  if (status === 401) {
    return (
      <Card className="mx-auto w-full max-w-xl">
        <div className="flex flex-col gap-4 text-center">
          <h1 className="font-heading text-2xl font-bold text-ink">ระบบเช็คชื่อเข้าเรียน</h1>
          <p className="text-body">
            เข้าสู่ระบบด้วยบัญชีของมหาวิทยาลัยผ่าน Core Hub เพื่อเช็คชื่อเข้าเรียน หรือจัดการกลุ่มเรียนของคุณ
          </p>
          <div>
            <ButtonLink href={SIGN_IN_URL} size="lg" className="w-full sm:w-auto">
              เข้าสู่ระบบผ่าน Core Hub
            </ButtonLink>
          </div>
        </div>
      </Card>
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
