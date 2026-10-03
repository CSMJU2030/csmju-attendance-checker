"use client";

import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  UserIcon,
  UsersIcon,
  formatDateTime,
  formatTime,
} from "@/components/shared/kit";
import { Modal } from "@/csmju";
import { apiRequest } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import type { AttendanceRecord, AttendanceSession, CurrentCode } from "@/lib/types";
import { SessionStatusBadge } from "./session-status";

const RECORDS_POLL_MS = 5_000;

/**
 * Opens this subsystem's check-in page with the current code filled in. The
 * student still signs in through Core Hub and is still checked against the
 * room's location - the QR only saves typing the 6 digits.
 */
function CheckInQr({ code }: { code: string }) {
  const url = `${window.location.origin}/check-in?code=${code}`;
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-outline-variant/40">
      <QRCodeSVG
        value={url}
        size={176}
        marginSize={1}
        role="img"
        aria-label="คิวอาร์โค้ดสำหรับเช็คชื่อ สแกนแล้วจะเปิดหน้าเช็คชื่อพร้อมใส่รหัสให้"
        className="size-44 md:size-56"
      />
    </div>
  );
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/** Staff screen for one round: rotating code for the projector + live list. */
export function LiveSession({ initialSession, sectionLabel }: { initialSession: AttendanceSession; sectionLabel: string }) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [code, setCode] = useState<CurrentCode | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [loadedRecords, setLoadedRecords] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const codeCard = useRef<HTMLDivElement>(null);
  // Records present at the first load are "old"; anything after is marked new.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const open = session.status === "OPEN";

  const loadCode = useCallback(async () => {
    const result = await apiRequest<CurrentCode>("GET", `/api/v1/attendance-sessions/${session.id}/code`);
    if (result.ok) {
      setCode(result.data);
      setCodeError(null);
    } else if (result.status === 409) {
      // Closed from another tab or by an admin.
      setSession((current) => ({ ...current, status: "CLOSED" }));
      router.refresh();
    } else if (result.status !== 401) {
      setCodeError(errorMessage(result.error));
    }
  }, [session.id, router]);

  const loadRecords = useCallback(async () => {
    const result = await apiRequest<AttendanceRecord[]>(
      "GET",
      `/api/v1/attendance-sessions/${session.id}/records?limit=100`,
    );
    setLoadedRecords(true);
    if (result.ok) {
      const newest = [...result.data].sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
      if (seen.current === null) {
        seen.current = new Set(newest.map((record) => record.id));
      } else {
        const arrived = newest.filter((record) => !seen.current!.has(record.id)).map((record) => record.id);
        if (arrived.length > 0) {
          arrived.forEach((id) => seen.current!.add(id));
          setFresh((current) => new Set([...current, ...arrived]));
          window.setTimeout(() => {
            setFresh((current) => new Set([...current].filter((id) => !arrived.includes(id))));
          }, 15_000);
        }
      }
      setRecords(newest);
      setTotal(result.meta?.total ?? result.data.length);
      setRecordsError(null);
    } else if (result.status !== 401) {
      setRecordsError(errorMessage(result.error));
    }
  }, [session.id]);

  // Code: fetch now, then again right after each 2-minute window ends.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (!code) {
      void loadCode();
      return;
    }
    const msLeft = new Date(code.expiresAt).getTime() - Date.now();
    const timer = window.setTimeout(() => void loadCode(), Math.max(1_000, msLeft + 300));
    return () => window.clearTimeout(timer);
  }, [open, code, loadCode]);

  // Countdown shown under the code.
  useEffect(() => {
    if (!open || !code) {
      return;
    }
    const tick = () => setSecondsLeft(Math.ceil((new Date(code.expiresAt).getTime() - Date.now()) / 1000));
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [open, code]);

  // Check-ins: poll while open, load once when closed.
  useEffect(() => {
    void loadRecords();
    if (!open) {
      return;
    }
    const timer = window.setInterval(() => void loadRecords(), RECORDS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [open, loadRecords]);

  async function close() {
    setCloseError(null);
    setClosing(true);
    const result = await apiRequest<AttendanceSession>("POST", `/api/v1/attendance-sessions/${session.id}/close`);
    setClosing(false);
    if (result.ok) {
      setSession(result.data);
      setCode(null);
      setConfirmClose(false);
      router.refresh();
    } else if (result.status !== 401) {
      setCloseError(errorMessage(result.error));
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void codeCard.current?.requestFullscreen();
    }
  }

  const stepSeconds = code?.stepSeconds ?? 120;
  const progress = code ? Math.min(100, Math.max(0, (secondsLeft / stepSeconds) * 100)) : 0;
  // Last 20 s of a window: warn so staff do not read out a code that is about to change.
  const rotatingSoon = code !== null && secondsLeft <= 20;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2">
        <SessionStatusBadge status={session.status} />
        <span className="text-sm/relaxed text-on-surface-variant tabular-nums">
          เปิดเมื่อ {formatDateTime(session.openedAt)}
          {session.closedAt ? ` · ปิดเมื่อ ${formatTime(session.closedAt)}` : ""}
        </span>
      </div>

      <div className={open ? "grid items-start gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "flex flex-col gap-8"}>
      {open ? (
        <div
          ref={codeCard}
          className="flex flex-col items-center gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-center md:p-12 xl:sticky xl:top-16"
        >
          <p className="text-on-surface-variant">รหัสเช็คชื่อ · {sectionLabel}</p>
          {codeError ? (
            <Alert tone="danger" title="โหลดรหัสไม่สำเร็จ" action={<Button variant="secondary" onClick={() => void loadCode()}>ลองอีกครั้ง</Button>}>
              {codeError}
            </Alert>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <p
                aria-live="polite"
                aria-label={code ? `รหัส ${code.code.split("").join(" ")}` : "กำลังโหลดรหัส"}
                className="whitespace-nowrap font-mono text-[56px]/[1.2] font-semibold text-on-surface tabular-nums md:text-[96px]/[1.1]"
              >
                {code ? `${code.code.slice(0, 3)} ${code.code.slice(3)}` : "--- ---"}
              </p>
              {code ? <CheckInQr code={code.code} /> : null}
            </div>
          )}
          <div className="flex w-full max-w-md flex-col gap-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary-container/10" aria-hidden>
              {/* Width is a runtime value - the one allowed use of inline style. */}
              <div className={"h-full " + (rotatingSoon ? "bg-amber-500" : "bg-primary-container")} style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm/relaxed text-on-surface-variant tabular-nums">
              {!code
                ? "กำลังโหลดรหัส..."
                : rotatingSoon
                  ? `รหัสกำลังจะเปลี่ยนในอีก ${formatCountdown(secondsLeft)} นาที`
                  : `รหัสจะเปลี่ยนในอีก ${formatCountdown(secondsLeft)} นาที`}
            </p>
          </div>
          <p className="max-w-prose text-on-surface-variant">
            ให้นักศึกษาสแกนคิวอาร์โค้ด หรือเปิดเมนู &quot;เช็คชื่อ&quot; ในระบบเช็คชื่อเข้าเรียนแล้วกรอกรหัสนี้ ขณะอยู่ในห้องเรียน
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={toggleFullscreen}>
              แสดงเต็มจอ
            </Button>
            <Button variant="danger" onClick={() => setConfirmClose(true)}>
              ปิดรอบเช็คชื่อ
            </Button>
          </div>
        </div>
      ) : (
        <Alert tone="info" title="รอบเช็คชื่อนี้ปิดแล้ว">
          นักศึกษาเช็คชื่อรอบนี้ไม่ได้อีก รายชื่อด้านล่างคือผลการเช็คชื่อทั้งหมด
        </Alert>
      )}

      <Card flush className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 md:px-6 md:pt-6">
          <CardTitle>นักศึกษาที่เช็คชื่อแล้ว</CardTitle>
          <p className="text-on-surface-variant tabular-nums" aria-live="polite">
            ทั้งหมด <span className="font-display text-[20px]/[1.5] font-semibold text-on-surface">{total}</span> คน
          </p>
        </div>

        {recordsError ? (
          <div className="px-4 pb-4 md:px-6 md:pb-6">
            <Alert tone="danger" title="โหลดรายชื่อไม่สำเร็จ">
              {recordsError}
            </Alert>
          </div>
        ) : !loadedRecords ? (
          <p className="px-4 pb-4 text-on-surface-variant md:px-6 md:pb-6">กำลังโหลดรายชื่อ...</p>
        ) : records.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="ยังไม่มีนักศึกษาเช็คชื่อ"
            description={open ? "รายชื่อจะขึ้นที่นี่อัตโนมัติเมื่อนักศึกษาเช็คชื่อ" : "ไม่มีนักศึกษาเช็คชื่อในรอบนี้"}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-outline-variant/40 border-t border-outline-variant/40">
            {records.map((record) => {
              const isNew = fresh.has(record.id);
              return (
                <li
                  key={record.id}
                  className={
                    "flex items-center gap-3 px-4 py-3 transition-colors duration-300 md:px-6 " +
                    (isNew ? "bg-success/10" : "")
                  }
                >
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container/10 text-primary-container"
                  >
                    <UserIcon size={16} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    {record.personCode ? (
                      <span className="truncate font-mono font-semibold text-on-surface tabular-nums">{record.personCode}</span>
                    ) : (
                      // Core Hub has no person for this account (e.g. a test account).
                      <span className="truncate text-on-surface-variant">บัญชีที่ไม่มีรหัสนักศึกษา</span>
                    )}
                    <span className="text-sm/relaxed text-on-surface-variant tabular-nums">
                      {formatTime(record.checkedInAt)} · ห่าง {record.distanceMeters} เมตร
                    </span>
                  </span>
                  {isNew ? <Badge tone="success">ใหม่</Badge> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      </div>

      {confirmClose ? (
        <Modal
          title={`ปิดรอบเช็คชื่อ ${sectionLabel}?`}
          onClose={() => {
            if (!closing) {
              setConfirmClose(false);
              setCloseError(null);
            }
          }}
        >
          <p className="text-body-md text-on-surface-variant">
            นักศึกษาที่ยังไม่ได้เช็คชื่อจะเช็คชื่อรอบนี้ไม่ได้อีก มีผู้เช็คชื่อแล้ว {total} คน
          </p>
          {closeError ? (
            <p role="alert" className="mt-4 rounded-2xl bg-error-container px-4 py-3 text-label-md text-on-error-container">
              {closeError}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              disabled={closing}
              onClick={() => {
                setConfirmClose(false);
                setCloseError(null);
              }}
            >
              ยกเลิก
            </Button>
            <Button variant="danger" onClick={close} loading={closing}>
              ปิดรอบเช็คชื่อ
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
