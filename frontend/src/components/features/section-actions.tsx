"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, ButtonLink, ConfirmDialog, MapPinIcon, PencilIcon, TrashIcon } from "@csmju2030/design-system";
import { apiRequest } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import type { AttendanceSession } from "@/lib/types";

/** Open-session and delete actions on the section page. */
export function SectionActions({
  sectionId,
  sectionLabel,
  openSessionId,
  sessionCount,
  canEdit,
  canDelete,
  canOpen,
}: {
  sectionId: string;
  sectionLabel: string;
  openSessionId: string | null;
  sessionCount: number;
  canEdit: boolean;
  canDelete: boolean;
  canOpen: boolean;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function openSession() {
    setOpenError(null);
    setOpening(true);
    const result = await apiRequest<AttendanceSession>("POST", "/api/v1/attendance-sessions", { classSectionId: sectionId });
    setOpening(false);
    if (result.ok) {
      router.push(`/attendance-sessions/${result.data.id}`);
      return;
    }
    if (result.status !== 401) {
      setOpenError(errorMessage(result.error));
      router.refresh();
    }
  }

  async function remove() {
    setDeleteError(null);
    setDeleting(true);
    const result = await apiRequest<{ id: string; deleted: true }>("DELETE", `/api/v1/class-sections/${sectionId}`);
    setDeleting(false);
    if (result.ok) {
      setConfirmDelete(false);
      router.push("/class-sections?deleted=1");
      router.refresh();
      return;
    }
    if (result.status !== 401) {
      setDeleteError(errorMessage(result.error));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-2">
        {canOpen ? (
          openSessionId ? (
            <ButtonLink href={`/attendance-sessions/${openSessionId}`}>
              <MapPinIcon size={16} />
              ไปยังรอบเช็คชื่อที่เปิดอยู่
            </ButtonLink>
          ) : (
            <Button onClick={openSession} loading={opening}>
              <MapPinIcon size={16} />
              เปิดรอบเช็คชื่อ
            </Button>
          )
        ) : null}
        {canEdit ? (
          <ButtonLink href={`/class-sections/${sectionId}/edit`} variant="secondary">
            <PencilIcon size={16} />
            แก้ไข
          </ButtonLink>
        ) : null}
        {canDelete ? (
          <Button
            id="delete-section"
            variant="ghost"
            className="text-danger"
            onClick={() => setConfirmDelete(true)}
            disabled={sessionCount > 0}
            disabledReason="ลบไม่ได้ เพราะกลุ่มเรียนนี้มีประวัติการเช็คชื่อแล้ว"
          >
            <TrashIcon size={16} />
            ลบ
          </Button>
        ) : null}
      </div>

      {openError ? <Alert tone="warning" title="เปิดรอบเช็คชื่อไม่สำเร็จ">{openError}</Alert> : null}

      <ConfirmDialog
        open={confirmDelete}
        title={`ลบกลุ่มเรียน "${sectionLabel}"?`}
        confirmLabel="ลบกลุ่มเรียน"
        loading={deleting}
        error={deleteError}
        onConfirm={remove}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteError(null);
        }}
      >
        กลุ่มเรียนนี้จะถูกลบถาวร และเปิดรอบเช็คชื่อไม่ได้อีก
      </ConfirmDialog>
    </div>
  );
}
