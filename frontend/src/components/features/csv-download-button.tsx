"use client";

import { Button, DownloadIcon } from "@/components/shared/kit";
import { downloadCsv } from "@/lib/csv";

/** Saves CSV content the page already has (built on the server) as a file. */
export function CsvDownloadButton({ csv, fileName, label }: { csv: string; fileName: string; label: string }) {
  return (
    <Button variant="secondary" onClick={() => downloadCsv(csv, fileName)}>
      <DownloadIcon size={16} />
      {label}
    </Button>
  );
}
