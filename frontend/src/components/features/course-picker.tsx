"use client";

import { useEffect, useState, type Ref } from "react";
import { Button, FormField, SearchIcon, TextInput, fieldA11y, formatNumber } from "@/components/shared/kit";
import { apiRequest } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import type { CourseSummary } from "@/lib/types";

const HINT = "พิมพ์รหัสหรือชื่อวิชา แล้วเลือกจากรายวิชาของมหาวิทยาลัย (Core Hub)";

/**
 * Picks an open Core Hub course for a new class section. The section keeps the
 * course code only; its name is always read from Core Hub (reference-data.md 8).
 */
export function CoursePicker({
  selected,
  onSelect,
  error,
  inputRef,
}: {
  selected: CourseSummary | null;
  onSelect: (course: CourseSummary | null) => void;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CourseSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (selected || q.trim().length < 2) {
      setResults(null);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const result = await apiRequest<CourseSummary[]>("GET", `/api/v1/courses?${new URLSearchParams({ q: q.trim(), limit: "20" })}`);
      if (!alive) return;
      setLoading(false);
      if (result.ok) {
        setResults(result.data);
        setLoadError(null);
      } else {
        setResults(null);
        setLoadError(errorMessage(result.error));
      }
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [q, selected]);

  if (selected) {
    return (
      <div className="flex flex-col gap-2">
        <span className="font-semibold text-on-surface">
          รายวิชา <span className="text-error">*</span>
        </span>
        <div className="flex flex-col gap-3 rounded-lg border border-primary-container/40 bg-primary-container/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-sm/relaxed text-on-surface-variant">{selected.code}</span>
            <span className="font-semibold text-on-surface">{selected.nameTh}</span>
            <span className="text-sm/relaxed text-on-surface-variant">{formatNumber(selected.credits)} หน่วยกิต</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onSelect(null)}>
            เปลี่ยนรายวิชา
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <FormField id="courseCode" label="รายวิชา" required hint={HINT} error={error}>
        <div className="relative">
          <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <TextInput
            {...fieldA11y("courseCode", { error, hint: HINT, required: true })}
            ref={inputRef}
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="เช่น 10301111 หรือ การเขียนโปรแกรม"
            autoComplete="off"
            className="pl-9"
          />
        </div>
      </FormField>
      <p className="sr-only" aria-live="polite">
        {loading ? "กำลังค้นหารายวิชา" : results ? `พบ ${results.length} รายวิชา` : ""}
      </p>
      {loadError ? <p className="text-sm/relaxed text-error">ค้นหารายวิชาไม่สำเร็จ: {loadError}</p> : null}
      {results && results.length === 0 ? (
        <p className="text-sm/relaxed text-on-surface-variant">ไม่พบรายวิชาที่เปิดอยู่ ลองพิมพ์รหัสหรือชื่อให้สั้นลง</p>
      ) : null}
      {results && results.length > 0 ? (
        <ul aria-label="ผลการค้นหารายวิชา" className="flex max-h-72 flex-col divide-y divide-outline-variant/40 overflow-y-auto rounded-lg border border-outline-variant/40">
          {results.map((course) => (
            <li key={course.code}>
              <button
                type="button"
                onClick={() => {
                  onSelect(course);
                  setQ("");
                }}
                className="flex min-h-11 w-full flex-col items-start gap-0.5 px-4 py-2 text-left transition-colors duration-150 hover:bg-primary-container/10 focus-visible:bg-primary-container/10"
              >
                <span className="font-mono text-sm/relaxed text-on-surface-variant">{course.code}</span>
                <span className="text-on-surface">
                  {course.nameTh} <span className="text-on-surface-variant">· {formatNumber(course.credits)} หน่วยกิต</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
