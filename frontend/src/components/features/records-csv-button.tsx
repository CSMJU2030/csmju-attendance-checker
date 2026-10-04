"use client";

import { useState } from "react";
import { Alert, Button, DownloadIcon } from "@/components/shared/kit";
import { apiRequest } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { type RecordFilters, recordsApiQuery, recordsCsv } from "@/lib/record-filters";
import type { StaffAttendanceRecord } from "@/lib/types";

const PAGE_SIZE = 100;
/** 50 pages of 100 - far beyond one section's term, and a bound on the loop. */
const MAX_PAGES = 50;

/**
 * Downloads every check-in that matches the current search as a CSV file
 * that opens in Excel. The rows come from the same API as the table, page by
 * page, so the file always matches what the search shows.
 */
export function RecordsCsvButton({
  sectionId,
  filters,
  fileName,
}: {
  sectionId: string;
  filters: RecordFilters;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const records: StaffAttendanceRecord[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const result = await apiRequest<StaffAttendanceRecord[]>(
          "GET",
          `/api/v1/attendance-records?${recordsApiQuery(sectionId, filters, page, PAGE_SIZE)}`,
        );
        if (!result.ok) {
          setError(errorMessage(result.error));
          return;
        }
        records.push(...result.data);
        if (!result.meta || page >= result.meta.totalPages) {
          break;
        }
      }

      const url = URL.createObjectURL(new Blob([recordsCsv(records)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={download} loading={busy}>
        <DownloadIcon size={16} />
        ดาวน์โหลด CSV (Excel)
      </Button>
      {error ? (
        <Alert tone="danger" title="ดาวน์โหลดไม่สำเร็จ">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
