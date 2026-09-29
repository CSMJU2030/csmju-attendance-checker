"use client";

import { Button, ErrorState } from "@csmju2030/design-system";
import { STANDARD_MESSAGE } from "@/lib/errors";

/** Unexpected render error. The raw message is never shown (section 16.1.1). */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="เกิดข้อผิดพลาดในการแสดงผล"
      description={STANDARD_MESSAGE.INTERNAL_ERROR}
      reference={error.digest}
      action={
        <Button variant="secondary" onClick={reset}>
          ลองอีกครั้ง
        </Button>
      }
    />
  );
}
