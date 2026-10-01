"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CheckCircleIcon,
  ClockIcon,
  FormField,
  KeyRoundIcon,
  MapPinIcon,
  fieldA11y,
  formatDateTime,
  formatTerm,
  type Tone,
} from "@/components/shared/kit";
import { apiRequest } from "@/lib/api-client";
import { classifyCheckInFailure } from "@/lib/check-in";
import type { AttendanceRecordView } from "@/lib/types";
import { CodeInput } from "./code-input";

type Phase = "idle" | "locating" | "submitting";

interface Notice {
  tone: Tone;
  title: string;
  message: string;
}

const CODE_PATTERN = /^\d{6}$/;

const STEPS = [
  { title: "กรอกรหัส", detail: "ดูรหัส 6 หลักจากจอในห้องเรียน", icon: <KeyRoundIcon size={16} /> },
  { title: "อนุญาตตำแหน่ง", detail: "เพื่อยืนยันว่าคุณอยู่ในห้อง", icon: <MapPinIcon size={16} /> },
  { title: "ได้ผลทันที", detail: "มาตรงเวลาหรือมาสาย", icon: <CheckCircleIcon size={16} /> },
];
const CODE_HINT = "รหัส 6 หลักที่อาจารย์แสดงในห้องเรียน รหัสเปลี่ยนทุก 2 นาที";

const GEO_ERROR: Record<number, Notice> = {
  1: {
    tone: "warning",
    title: "ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง",
    message: "ระบบต้องใช้ตำแหน่งของอุปกรณ์เพื่อยืนยันว่าคุณอยู่ในห้องเรียน กรุณาอนุญาตการเข้าถึงตำแหน่งในการตั้งค่าเบราว์เซอร์ แล้วลองอีกครั้ง",
  },
  2: {
    tone: "warning",
    title: "หาตำแหน่งของอุปกรณ์ไม่ได้",
    message: "กรุณาเปิด GPS หรือบริการตำแหน่งของอุปกรณ์ แล้วลองอีกครั้ง",
  },
  3: {
    tone: "warning",
    title: "หาตำแหน่งนานเกินไป",
    message: "สัญญาณตำแหน่งอ่อน กรุณาขยับไปใกล้หน้าต่างหรือที่โล่ง แล้วลองอีกครั้ง",
  },
};

function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: 0,
    });
  });
}

export function CheckInForm() {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [result, setResult] = useState<AttendanceRecordView | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(value: string): string | undefined {
    return CODE_PATTERN.test(value) ? undefined : "กรอกรหัส 6 หลักที่อาจารย์แสดงในห้องเรียน";
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);

    const invalid = validate(code);
    setCodeError(invalid);
    if (invalid) {
      inputRef.current?.focus();
      return;
    }

    if (!("geolocation" in navigator) || !window.isSecureContext) {
      setNotice({
        tone: "danger",
        title: "อุปกรณ์นี้ระบุตำแหน่งไม่ได้",
        message: "การเช็คชื่อต้องใช้ตำแหน่งของอุปกรณ์ กรุณาเปิดหน้านี้ด้วยเบราว์เซอร์บนมือถือผ่านลิงก์ https",
      });
      return;
    }

    setPhase("locating");
    let position: GeolocationPosition;
    try {
      position = await locate();
    } catch (error) {
      const geoCode = (error as GeolocationPositionError).code;
      setNotice(GEO_ERROR[geoCode] ?? GEO_ERROR[2]);
      setPhase("idle");
      return;
    }

    setPhase("submitting");
    const response = await apiRequest<AttendanceRecordView>("POST", "/api/v1/attendance-records", {
      code,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
    });
    setPhase("idle");

    if (response.ok) {
      setResult(response.data);
      setCode("");
      return;
    }

    const failure = classifyCheckInFailure(response.status, response.error);
    if (failure.kind === "field") {
      setCodeError(failure.message);
      inputRef.current?.focus();
    } else if (failure.kind === "notice") {
      setNotice({ tone: failure.tone, title: failure.title, message: failure.message });
    }
  }

  if (result) {
    const late = result.status === "LATE";
    const section = result.classSection;
    return (
      <Card flush className="flex flex-col" aria-live="polite">
        <div className={"flex flex-col items-center gap-3 px-6 py-8 text-center " + (late ? "bg-amber-50" : "bg-success/10")}>
          <span
            aria-hidden
            className={"flex size-16 items-center justify-center rounded-full bg-surface-container-lowest " + (late ? "text-amber-800" : "text-emerald-700")}
          >
            {late ? <ClockIcon size={48} /> : <CheckCircleIcon size={48} />}
          </span>
          <h2 className="font-display text-headline-md font-semibold text-on-surface">เช็คชื่อสำเร็จ</h2>
          <Badge tone={late ? "warning" : "success"}>{late ? "มาสาย" : "มาตรงเวลา"}</Badge>
        </div>
        <dl className="flex flex-col divide-y divide-outline-variant/40 px-6 text-on-surface-variant">
          {section ? (
            <div className="flex flex-col gap-1 py-4">
              <dt className="text-sm/relaxed text-on-surface-variant">รายวิชา</dt>
              <dd className="font-semibold text-on-surface">
                {section.courseCode} {section.courseName}
              </dd>
              <dd className="text-sm/relaxed">
                กลุ่ม {section.sectionCode} · {formatTerm(section.term, section.academicYear)}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 py-4">
            <dt className="text-sm/relaxed text-on-surface-variant">เวลาเช็คชื่อ</dt>
            <dd className="text-right font-semibold text-on-surface tabular-nums">{formatDateTime(result.checkedInAt)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <dt className="text-sm/relaxed text-on-surface-variant">ระยะห่างจากจุดเช็คชื่อ</dt>
            <dd className="font-semibold text-on-surface tabular-nums">{result.distanceMeters} เมตร</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-2 border-t border-outline-variant/40 p-6 sm:flex-row">
          <ButtonLink href="/attendance-records" variant="secondary">
            ดูประวัติการเช็คชื่อ
          </ButtonLink>
          <Button variant="ghost" onClick={() => setResult(null)}>
            เช็คชื่อรายวิชาอื่น
          </Button>
        </div>
      </Card>
    );
  }

  const busy = phase !== "idle";

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <p className="text-sm/relaxed text-on-surface-variant">ช่องที่มี * จำเป็นต้องกรอก</p>

        {notice ? (
          <Alert tone={notice.tone} title={notice.title}>
            {notice.message}
          </Alert>
        ) : null}

        <FormField
          id="code"
          label="รหัสเช็คชื่อ"
          required
          hint={CODE_HINT}
          error={codeError}
        >
          <CodeInput
            ref={inputRef}
            {...fieldA11y("code", { error: codeError, hint: CODE_HINT, required: true })}
            name="code"
            value={code}
            invalid={Boolean(codeError)}
            onChange={setCode}
            onBlur={() => code && setCodeError(validate(code))}
          />
        </FormField>

        <div aria-live="polite" className="sr-only">
          {phase === "locating" ? "กำลังหาตำแหน่งของอุปกรณ์" : phase === "submitting" ? "กำลังบันทึกการเช็คชื่อ" : ""}
        </div>

        <Button type="submit" size="lg" loading={busy} className="w-full">
          {phase === "locating" ? "กำลังหาตำแหน่ง..." : phase === "submitting" ? "กำลังเช็คชื่อ..." : "เช็คชื่อ"}
        </Button>
      </form>

      <ol className="mt-6 grid gap-4 border-t border-outline-variant/40 pt-6 text-sm/relaxed text-on-surface-variant sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
              {step.icon}
            </span>
            <span className="flex flex-col">
              <span className="font-semibold text-on-surface">
                {index + 1}. {step.title}
              </span>
              {step.detail}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
