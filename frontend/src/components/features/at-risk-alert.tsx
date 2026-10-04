"use client";

import { useEffect, useState } from "react";
import { AlertTriangleIcon, Badge, Button, ButtonLink, formatNumber, formatPercent } from "@/components/shared/kit";
import { atRiskKey, unseenEntries } from "@/lib/at-risk";
import type { AtRiskEntry } from "@/lib/types";

const SHOWN = 5;

/**
 * Dashboard alert for lecturers: how many students are at risk, and which
 * ones are new since the lecturer last pressed "รับทราบ". What was seen is
 * remembered in this browser only (localStorage) - a convenience, not data.
 */
export function AtRiskAlert({ entries, coreUserId }: { entries: AtRiskEntry[]; coreUserId: string }) {
  const storageKey = `attendance-checker:seen-at-risk:${coreUserId}`;
  const [seen, setSeen] = useState<Set<string> | null>(null);

  useEffect(() => {
    let stored: string[] = [];
    try {
      stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as string[];
    } catch {
      stored = [];
    }
    setSeen(new Set(Array.isArray(stored) ? stored : []));
  }, [storageKey]);

  if (entries.length === 0) {
    return null;
  }
  // Until the browser storage is read, treat nothing as new - no flash of "new".
  const fresh = seen ? unseenEntries(entries, seen) : [];
  const listed = (fresh.length > 0 ? fresh : entries).slice(0, SHOWN);

  function acknowledge() {
    const keys = entries.map(atRiskKey);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(keys));
    } catch {
      // Storage blocked: the alert simply shows as new again next time.
    }
    setSeen(new Set(keys));
  }

  return (
    <section
      aria-labelledby="at-risk-alert"
      className="flex flex-col gap-4 rounded-2xl border border-error/30 bg-error-container/30 p-4 md:p-6"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-error-container text-on-error-container">
          <AlertTriangleIcon />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="at-risk-alert" className="flex flex-wrap items-center gap-2 font-display text-[20px]/[1.5] font-semibold text-on-surface">
            นักศึกษากลุ่มเสี่ยง {formatNumber(entries.length)} คน
            {fresh.length > 0 ? <Badge tone="danger">{`ใหม่ ${formatNumber(fresh.length)} คน`}</Badge> : null}
          </h2>
          <p className="text-on-surface-variant">ขาดเรียนตั้งแต่ 30% ของรอบที่ปิดแล้ว ควรติดตามก่อนสิ้นภาคเรียน</p>
        </div>
      </div>
      {/* w-0 + min-w-full: a long course name is cut off inside the card instead of widening the page. */}
      <ul className="flex w-0 min-w-full flex-col divide-y divide-outline-variant/40 rounded-lg border border-outline-variant/40 bg-surface-container-lowest">
        {listed.map((entry) => (
          <li key={atRiskKey(entry)} className="flex items-center gap-3 px-4 py-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-mono font-semibold text-on-surface tabular-nums">{entry.personCode}</span>
              <span className="truncate text-sm/relaxed text-on-surface-variant">
                {entry.courseCode} {entry.courseName} · กลุ่ม {entry.sectionCode}
              </span>
            </span>
            <span className="shrink-0 font-semibold text-error tabular-nums">ขาด {formatPercent(entry.absenceRate)}</span>
          </li>
        ))}
      </ul>
      {(fresh.length > 0 ? fresh.length : entries.length) > SHOWN ? (
        <p className="text-sm/relaxed text-on-surface-variant">
          และอีก {formatNumber((fresh.length > 0 ? fresh.length : entries.length) - SHOWN)} คน
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <ButtonLink href="/stats">ดูสถิติและกลุ่มเสี่ยง</ButtonLink>
        {fresh.length > 0 ? (
          <Button variant="secondary" onClick={acknowledge}>
            รับทราบ
          </Button>
        ) : null}
      </div>
    </section>
  );
}
