"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDeleteModal } from "@/csmju";
import { Button, TrashIcon } from "@/components/shared/kit";
import { apiRequest } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";

/** Takes one student off the roster after a confirmation. */
export function RosterRemoveButton({ sectionId, personCode }: { sectionId: string; personCode: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function remove() {
    if (busy) return;
    setBusy(true);
    const result = await apiRequest("DELETE", `/api/v1/class-sections/${sectionId}/students/${encodeURIComponent(personCode)}`);
    setBusy(false);
    if (result.ok || result.status === 404) {
      setConfirming(false);
      router.refresh();
      return;
    }
    setError(errorMessage(result.error));
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label={`เอา ${personCode} ออกจากรายชื่อ`}>
        <TrashIcon size={16} />
        <span className="hidden sm:inline">เอาออก</span>
      </Button>
      {confirming ? (
        <ConfirmDeleteModal
          title={`เอา ${personCode} ออกจากรายชื่อ?`}
          message="ประวัติการเช็คชื่อของนักศึกษาคนนี้ยังอยู่ครบ แต่จะขึ้นป้าย ไม่อยู่ในรายชื่อ"
          blockedReason={error}
          onConfirm={remove}
          onClose={() => {
            setConfirming(false);
            setError(undefined);
          }}
        />
      ) : null}
    </>
  );
}
