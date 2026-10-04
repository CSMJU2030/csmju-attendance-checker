"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ChangeEvent } from "react";
import { Tabs, inputClass } from "@/csmju";
import {
  Alert,
  Button,
  Card,
  FormField,
  PlusIcon,
  SearchIcon,
  Select,
  TextInput,
  fieldA11y,
  formatNumber,
} from "@/components/shared/kit";
import { apiRequest } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { ROSTER_BATCH, chunk, extractStudentCodes, parseEntryYear } from "@/lib/roster";
import type { AddRosterStudentsResult, Department, StudentSummary } from "@/lib/types";

type Mode = "paste" | "cohort";

interface Outcome {
  tone: "success" | "warning" | "danger";
  title: string;
  message?: string;
}

/** A whole cohort is read 100 per Core Hub call; this bounds the loop. */
const MAX_COHORT_PAGES = 20;

/** POSTs ids in batches the backend accepts and sums up what happened. */
async function addAll(sectionId: string, codes: string[]): Promise<Outcome> {
  let added = 0;
  let already = 0;
  for (const batch of chunk(codes, ROSTER_BATCH)) {
    const result = await apiRequest<AddRosterStudentsResult>("POST", `/api/v1/class-sections/${sectionId}/students`, {
      personCodes: batch,
    });
    if (!result.ok) {
      return {
        tone: "danger",
        title: added > 0 ? `เพิ่มได้ ${formatNumber(added)} คน แล้วหยุดเพราะเกิดข้อผิดพลาด` : "เพิ่มรายชื่อไม่สำเร็จ",
        message: errorMessage(result.error),
      };
    }
    added += result.data.added;
    already += result.data.alreadyOnRoster.length;
  }
  return {
    tone: "success",
    title: `เพิ่มเข้ารายชื่อ ${formatNumber(added)} คน`,
    message: already > 0 ? `อีก ${formatNumber(already)} คนอยู่ในรายชื่ออยู่แล้ว` : undefined,
  };
}

/**
 * Two ways in: paste ids (or pick the registrar's CSV), or take every active
 * student of a department and entry year from Core Hub. Pasted ids are checked
 * for format only - Core Hub may not be asked once per student.
 */
export function RosterAdd({ sectionId, canSearchPeople }: { sectionId: string; canSearchPeople: boolean }) {
  const [mode, setMode] = useState<Mode>("paste");
  const tabs = canSearchPeople
    ? [
        { id: "paste" as const, label: "วางรหัส / CSV" },
        { id: "cohort" as const, label: "ตามสาขาและชั้นปี" },
      ]
    : [{ id: "paste" as const, label: "วางรหัส / CSV" }];

  return (
    <Card className="flex flex-col gap-6">
      {/* w-0 + min-w-full: the tab row scrolls inside the card instead of widening the page. */}
      <div className="w-0 min-w-full">
        <Tabs tabs={tabs} active={mode} onChange={setMode} />
      </div>
      {mode === "paste" ? <PasteCodes sectionId={sectionId} /> : <CohortPicker sectionId={sectionId} />}
    </Card>
  );
}

function PasteCodes({ sectionId }: { sectionId: string }) {
  const router = useRouter();
  const textId = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const codes = extractStudentCodes(text);
  const hint = "วางรหัสนักศึกษาทีละบรรทัด คั่นด้วยจุลภาคหรือเว้นวรรคก็ได้ ระบบเลือกเฉพาะตัวเลข 8–15 หลัก";

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setText(await file.text());
      setOutcome(null);
    }
    event.target.value = "";
  }

  async function submit() {
    if (busy) return;
    if (codes.length === 0) {
      setError("ไม่พบรหัสนักศึกษาในข้อความ");
      return;
    }
    setError(undefined);
    setBusy(true);
    const result = await addAll(sectionId, codes);
    setBusy(false);
    setOutcome(result);
    if (result.tone !== "danger") {
      setText("");
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField id={textId} label="รหัสนักศึกษา" hint={hint} error={error}>
        <textarea
          {...fieldA11y(textId, { error, hint })}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOutcome(null);
          }}
          rows={6}
          className={`${inputClass} font-mono ${error ? "input-error" : ""}`}
          placeholder={"6504101234\n6504101235"}
        />
      </FormField>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${textId}-file`} className="font-semibold text-on-surface">
          หรือเลือกไฟล์ CSV จากระบบทะเบียน
        </label>
        <input
          id={`${textId}-file`}
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={readFile}
          className="block w-full min-w-0 text-body-md text-on-surface-variant file:mr-4 file:min-h-11 file:rounded-lg file:border-0 file:bg-primary-container/10 file:px-4 file:font-semibold file:text-primary-container"
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={submit} loading={busy} disabled={codes.length === 0}>
          <PlusIcon size={16} />
          {codes.length > 0 ? `เพิ่ม ${formatNumber(codes.length)} คนเข้ารายชื่อ` : "เพิ่มเข้ารายชื่อ"}
        </Button>
        <p className="text-sm/relaxed text-on-surface-variant" aria-live="polite">
          {codes.length > 0 ? `พบรหัสนักศึกษา ${formatNumber(codes.length)} รหัส` : ""}
        </p>
      </div>
      <p className="text-sm/relaxed text-on-surface-variant">
        ระบบตรวจแค่รูปแบบรหัส ไม่ได้ตรวจกับทะเบียนทีละคน ตรวจให้แน่ใจว่ารหัสถูกต้องก่อนเพิ่ม
      </p>
      {outcome ? (
        <Alert tone={outcome.tone} title={outcome.title}>
          {outcome.message}
        </Alert>
      ) : null}
    </div>
  );
}

function CohortPicker({ sectionId }: { sectionId: string }) {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [departmentsError, setDepartmentsError] = useState<string | null>(null);
  const [departmentCode, setDepartmentCode] = useState("");
  const [entryYear, setEntryYear] = useState("");
  const [yearError, setYearError] = useState<string>();
  const [preview, setPreview] = useState<{ items: StudentSummary[]; total: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    let alive = true;
    void apiRequest<Department[]>("GET", "/api/v1/departments").then((result) => {
      if (!alive) return;
      if (result.ok) setDepartments(result.data);
      else setDepartmentsError(errorMessage(result.error));
    });
    return () => {
      alive = false;
    };
  }, []);

  function query(page: number): string {
    const params = new URLSearchParams({ page: String(page), limit: "100" });
    if (departmentCode) params.set("departmentCode", departmentCode);
    const year = parseEntryYear(entryYear);
    if (year !== null) params.set("entryYear", String(year));
    return `/api/v1/people?${params}`;
  }

  async function search() {
    if (entryYear.trim() && parseEntryYear(entryYear) === null) {
      setYearError("กรอกปีที่เข้าศึกษาเป็น พ.ศ. 4 หลัก เช่น 2566");
      return;
    }
    if (!departmentCode && !entryYear.trim()) {
      setYearError("เลือกสาขาหรือกรอกปีที่เข้าศึกษาอย่างน้อยหนึ่งอย่าง");
      return;
    }
    setYearError(undefined);
    setOutcome(null);
    setSearching(true);
    const result = await apiRequest<StudentSummary[]>("GET", query(1));
    setSearching(false);
    if (!result.ok) {
      setPreview(null);
      setOutcome({ tone: "danger", title: "ค้นหานักศึกษาไม่สำเร็จ", message: errorMessage(result.error) });
      return;
    }
    setPreview({ items: result.data, total: result.meta?.total ?? result.data.length });
  }

  async function addCohort() {
    if (!preview || adding) return;
    setAdding(true);
    const codes = preview.items.map((student) => student.personCode);
    const pages = Math.min(Math.ceil(preview.total / 100), MAX_COHORT_PAGES);
    for (let page = 2; page <= pages; page += 1) {
      const result = await apiRequest<StudentSummary[]>("GET", query(page));
      if (!result.ok) {
        setAdding(false);
        setOutcome({ tone: "danger", title: "ดึงรายชื่อจาก Core Hub ไม่ครบ", message: errorMessage(result.error) });
        return;
      }
      codes.push(...result.data.map((student) => student.personCode));
    }
    const result = await addAll(sectionId, [...new Set(codes)]);
    setAdding(false);
    setOutcome(result);
    if (result.tone !== "danger") setPreview(null);
    router.refresh();
  }

  const selectedDepartment = departments?.find((department) => department.code === departmentCode);

  return (
    <div className="flex flex-col gap-4">
      {departmentsError ? (
        <Alert tone="warning" title="โหลดรายชื่อสาขาไม่สำเร็จ">
          {departmentsError}
        </Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end">
        <FormField id="cohort-department" label="สาขา">
          <Select
            id="cohort-department"
            value={departmentCode}
            onChange={(event) => {
              setDepartmentCode(event.target.value);
              setPreview(null);
            }}
            disabled={!departments}
          >
            <option value="">{departments ? "ทุกสาขา" : "กำลังโหลด..."}</option>
            {(departments ?? []).map((department) => (
              <option key={department.code} value={department.code}>
                {department.nameTh} ({department.code})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="cohort-year" label="ปีที่เข้าศึกษา (พ.ศ.)" error={yearError}>
          <TextInput
            {...fieldA11y("cohort-year", { error: yearError })}
            inputMode="numeric"
            maxLength={4}
            value={entryYear}
            onChange={(event) => {
              setEntryYear(event.target.value.replace(/\D/g, ""));
              setPreview(null);
            }}
            placeholder="2566"
          />
        </FormField>
        <Button variant="secondary" onClick={search} loading={searching}>
          <SearchIcon size={16} />
          ค้นหา
        </Button>
      </div>

      {preview ? (
        preview.total === 0 ? (
          <Alert tone="info" title="ไม่พบนักศึกษาที่ยังศึกษาอยู่ตามเงื่อนไขนี้" />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-on-surface-variant" role="status">
              พบนักศึกษา <span className="font-semibold text-on-surface">{formatNumber(preview.total)}</span> คน
              {selectedDepartment ? ` · ${selectedDepartment.nameTh}` : ""}
              {parseEntryYear(entryYear) !== null ? ` · เข้าปี ${entryYear}` : ""}
            </p>
            <ul className="flex max-h-72 flex-col divide-y divide-outline-variant/40 overflow-y-auto rounded-lg border border-outline-variant/40">
              {preview.items.map((student) => (
                <li key={student.personCode} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2">
                  <span className="font-mono text-on-surface tabular-nums">{student.personCode}</span>
                  <span className="text-on-surface-variant">{student.fullNameTh}</span>
                </li>
              ))}
            </ul>
            {preview.total > preview.items.length ? (
              <p className="text-sm/relaxed text-on-surface-variant">
                แสดง {formatNumber(preview.items.length)} คนแรก · กดเพิ่มแล้วระบบจะเพิ่มครบทุกคน
                {preview.total > MAX_COHORT_PAGES * 100 ? ` (สูงสุด ${formatNumber(MAX_COHORT_PAGES * 100)} คน)` : ""}
              </p>
            ) : null}
            <div>
              <Button onClick={addCohort} loading={adding}>
                <PlusIcon size={16} />
                เพิ่มทั้งหมด {formatNumber(Math.min(preview.total, MAX_COHORT_PAGES * 100))} คนเข้ารายชื่อ
              </Button>
            </div>
          </div>
        )
      ) : null}

      {outcome ? (
        <Alert tone={outcome.tone} title={outcome.title}>
          {outcome.message}
        </Alert>
      ) : null}
    </div>
  );
}
