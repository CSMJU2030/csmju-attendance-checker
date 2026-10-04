/**
 * Student ids in pasted text or a CSV export from the registrar: any run of
 * 8-15 digits counts, so row numbers, phone-like short numbers and names are
 * skipped. Order is kept and repeats are dropped.
 */
export function extractStudentCodes(text: string): string[] {
  const codes = text.match(/(?<!\d)\d{8,15}(?!\d)/g) ?? [];
  return [...new Set(codes)];
}

/** The backend takes at most this many ids per call. */
export const ROSTER_BATCH = 500;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    out.push(items.slice(start, start + size));
  }
  return out;
}

/** Buddhist-era entry year typed in the form, or null when it is not one. */
export function parseEntryYear(value: string): number | null {
  const year = Number(value.trim());
  return Number.isInteger(year) && year >= 2500 && year <= 2700 ? year : null;
}
