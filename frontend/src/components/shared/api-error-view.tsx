import { ButtonLink, EmptyState, ErrorState, SearchIcon, ShieldOffIcon, WifiOffIcon } from "@csmju2030/design-system";
import { PORTAL_URL } from "@/lib/config";
import { STANDARD_MESSAGE } from "@/lib/errors";
import type { ApiError } from "@/lib/types";

/** Full-area view for a failed page load, per ui-design-system.md 9.3. */
export function ApiErrorView({ error, retryHref, backHref = "/" }: { error: ApiError; retryHref: string; backHref?: string }) {
  switch (error.code) {
    case "UNAUTHORIZED":
      // The layout already swaps in the sign-in screen; show nothing here.
      return null;
    case "FORBIDDEN":
      return (
        <EmptyState
          icon={ShieldOffIcon}
          title="ไม่มีสิทธิ์เข้าถึง"
          description={STANDARD_MESSAGE.FORBIDDEN}
          action={
            <ButtonLink href={PORTAL_URL} variant="secondary">
              กลับหน้าหลัก
            </ButtonLink>
          }
        />
      );
    // A malformed id in the URL (400) means the same thing to the user as 404.
    case "NOT_FOUND":
    case "VALIDATION_ERROR":
    case "BAD_REQUEST":
      return (
        <EmptyState
          icon={SearchIcon}
          title="ไม่พบข้อมูล"
          description={STANDARD_MESSAGE.NOT_FOUND}
          action={
            <ButtonLink href={backHref} variant="secondary">
              ย้อนกลับ
            </ButtonLink>
          }
        />
      );
    case "NETWORK_ERROR":
      return (
        <EmptyState
          icon={WifiOffIcon}
          title="เชื่อมต่อไม่ได้"
          description={STANDARD_MESSAGE.NETWORK_ERROR}
          action={
            <ButtonLink href={retryHref} variant="secondary">
              ลองอีกครั้ง
            </ButtonLink>
          }
        />
      );
    default:
      return (
        <ErrorState
          title="โหลดข้อมูลไม่สำเร็จ"
          description={STANDARD_MESSAGE.INTERNAL_ERROR}
          action={
            <ButtonLink href={retryHref} variant="secondary">
              ลองอีกครั้ง
            </ButtonLink>
          }
        />
      );
  }
}
