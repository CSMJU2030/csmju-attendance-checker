import type { Metadata } from "next";
import { LogoutIcon } from "@/csmju";
import { ButtonLink, Card, buttonClasses } from "@/components/shared/kit";

export const metadata: Metadata = { title: "ออกจากระบบ" };

/**
 * The central shell links here to sign out. Signing out is POST /auth/logout
 * (auth-contract 5), which the backend answers by clearing this subsystem's
 * cookies and sending the browser on to Core Hub's /logout - a GET link must
 * not be able to sign anyone out, so this page asks before posting.
 */
export default function SignOutPage() {
  return (
    <Card className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
      <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
        <LogoutIcon className="size-7" />
      </span>
      <h1 className="font-display text-headline-md text-on-surface">ออกจากระบบ</h1>
      <p className="text-body-md text-on-surface-variant">
        ระบบจะออกจากระบบเช็คชื่อและ Core Hub ด้วย ถ้าใช้เครื่องร่วมกับคนอื่น ควรออกจากระบบทุกครั้ง
      </p>
      <form action="/auth/logout" method="post" className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <button type="submit" className={buttonClasses("danger", "md", "w-full sm:w-auto")}>
          ออกจากระบบ
        </button>
        <ButtonLink href="/" variant="secondary" className="w-full sm:w-auto">
          ยกเลิก
        </ButtonLink>
      </form>
    </Card>
  );
}
