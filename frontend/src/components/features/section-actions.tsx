"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDeleteModal } from "@/csmju";
import { Alert, Button, ButtonLink, Card, CardTitle, PresentationIcon, TrashIcon } from "@/components/shared/kit";
import { apiRequest } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import type { AttendanceSession } from "@/lib/types";

/** Primary action of the section page: open a session, or go to the open one. */
export function OpenSessionAction({ sectionId, openSessionId }: { sectionId: string; openSessionId: string | null }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (openSessionId) {
    return (
      <ButtonLink href={`/attendance-sessions/${openSessionId}`}>
        <PresentationIcon size={16} />
        แสดงรหัสรอบที่เปิดอยู่
      </ButtonLink>
    );
  }

  async function open() {
    setError(null);
    setOpening(true);
    const result = await apiRequest<AttendanceSession>("POST", "/api/v1/attendance-sessions", { classSectionId: sectionId });
    setOpening(false);
    if (result.ok) {
      router.push(`/attendance-sessions/${result.data.id}`);
      return;
    }
    if (result.status !== 401) {
      setError(errorMessage(result.error));
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={open} loading={opening}>
        <PresentationIcon size={16} />
        เปิดรอบเช็คชื่อ
      </Button>
      {error ? (
        <Alert tone="warning" title="เปิดรอบเช็คชื่อไม่สำเร็จ">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}

/**
 * Deleting sits in its own card at the end of the page, away from the everyday
 * actions. A section with attendance history cannot be deleted: the button is
 * disabled and the card says why (section 10.1).
 */
export function DeleteSectionCard({
  sectionId,
  sectionLabel,
  sessionCount,
}: {
  sectionId: string;
  sectionLabel: string;
  sessionCount: number;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = sessionCount > 0;

  async function remove() {
    if (deleting) {
      return;
    }
    setError(null);
    setDeleting(true);
    const result = await apiRequest<{ id: string; deleted: true }>("DELETE", `/api/v1/class-sections/${sectionId}`);
    setDeleting(false);
    if (result.ok) {
      setConfirm(false);
      router.push("/class-sections?deleted=1");
      router.refresh();
      return;
    }
    if (result.status !== 401) {
      setError(errorMessage(result.error));
    }
  }

  return (
    <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <CardTitle>ลบกลุ่มเรียน</CardTitle>
        <p id="delete-section-reason" className="text-on-surface-variant">
          {blocked
            ? `ลบไม่ได้ เพราะกลุ่มเรียนนี้มีประวัติการเช็คชื่อแล้ว ${sessionCount} รอบ`
            : "ลบกลุ่มเรียนนี้ถาวร ใช้เมื่อสร้างผิดหรือไม่ได้ใช้แล้วเท่านั้น"}
        </p>
      </div>
      <Button
        id="delete-section"
        variant="danger"
        onClick={() => setConfirm(true)}
        disabled={blocked}
        aria-describedby="delete-section-reason"
        className="shrink-0"
      >
        <TrashIcon size={16} />
        ลบกลุ่มเรียน
      </Button>

      {confirm ? (
        <ConfirmDeleteModal
          title={`ลบกลุ่มเรียน "${sectionLabel}"?`}
          message="กลุ่มเรียนนี้จะถูกลบถาวร และเปิดรอบเช็คชื่อไม่ได้อีก"
          // A refused delete (e.g. a session was opened meanwhile) shows why and disables the button.
          blockedReason={error ?? undefined}
          onConfirm={remove}
          onClose={() => {
            setConfirm(false);
            setError(null);
          }}
        />
      ) : null}
    </Card>
  );
}
