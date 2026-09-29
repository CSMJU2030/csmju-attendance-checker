"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CheckCircleIcon,
  ClockIcon,
  FormField,
  TextInput,
  fieldA11y,
  formatDateTime,
  formatTerm,
  type Tone,
} from "@csmju2030/design-system";
import { apiRequest } from "@/lib/api-client";
import { classifyCheckInFailure } from "@/lib/check-in";
import type { AttendanceRecordView } from "@/lib/types";

type Phase = "idle" | "locating" | "submitting";

interface Notice {
  tone: Tone;
  title: string;
  message: string;
}

const CODE_PATTERN = /^\d{6}$/;
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
      <Card className="flex flex-col gap-4" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className={late ? "text-warning" : "text-success"}>
            {late ? <ClockIcon size={32} /> : <CheckCircleIcon size={32} />}
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-xl font-semibold text-ink">เช็คชื่อสำเร็จ</h2>
            <div>
              <Badge tone={late ? "warning" : "success"}>{late ? "มาสาย" : "มาตรงเวลา"}</Badge>
            </div>
          </div>
        </div>
        <dl className="grid gap-3 text-body sm:grid-cols-2">
          {section ? (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <dt className="text-sm text-muted">รายวิชา</dt>
              <dd className="text-ink">
                {section.courseCode} {section.courseName} · กลุ่ม {section.sectionCode} ·{" "}
                {formatTerm(section.term, section.academicYear)}
              </dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted">เวลาเช็คชื่อ</dt>
            <dd className="text-ink tabular-nums">{formatDateTime(result.checkedInAt)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted">ระยะห่างจากจุดเช็คชื่อ</dt>
            <dd className="text-ink tabular-nums">{result.distanceMeters} เมตร</dd>
          </div>
        </dl>
        <div>
          <Button variant="secondary" onClick={() => setResult(null)}>
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
        <p className="text-sm text-muted">ช่องที่มี * จำเป็นต้องกรอก</p>

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
          <TextInput
            ref={inputRef}
            {...fieldA11y("code", { error: codeError, hint: CODE_HINT, required: true })}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            onBlur={() => code && setCodeError(validate(code))}
            className="min-h-14 text-center font-mono text-2xl tracking-[0.3em] tabular-nums"
          />
        </FormField>

        <div aria-live="polite" className="sr-only">
          {phase === "locating" ? "กำลังหาตำแหน่งของอุปกรณ์" : phase === "submitting" ? "กำลังบันทึกการเช็คชื่อ" : ""}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
            {phase === "locating" ? "กำลังหาตำแหน่ง..." : phase === "submitting" ? "กำลังเช็คชื่อ..." : "เช็คชื่อ"}
          </Button>
          <p className="text-sm text-muted">ระบบจะขอใช้ตำแหน่งของอุปกรณ์เพื่อยืนยันว่าคุณอยู่ในห้องเรียน</p>
        </div>
      </form>
    </Card>
  );
}
