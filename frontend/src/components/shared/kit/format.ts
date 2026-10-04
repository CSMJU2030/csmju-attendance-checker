/**
 * Display formatting (ui-design-system.md 11.3). Data from the API is ISO /
 * Gregorian; the screen always shows the Buddhist era in Asia/Bangkok time.
 */
const TIME_ZONE = "Asia/Bangkok";

const dateFormat = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const longDateFormat = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("th-TH", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const numberFormat = new Intl.NumberFormat("th-TH");

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** `11 ส.ค. 2569` · `formatDate(v, "long")` → `11 สิงหาคม 2569` */
export function formatDate(value: string | Date, style: "short" | "long" = "short"): string {
  return (style === "long" ? longDateFormat : dateFormat).format(toDate(value));
}

/** `09:30 น.` */
export function formatTime(value: string | Date): string {
  return `${timeFormat.format(toDate(value))} น.`;
}

/** `11 ส.ค. 2569 09:30 น.` */
export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

/** `2,450` */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** A 0-1 rate as a whole percentage, `-` when there is none yet: `56%`. */
export function formatPercent(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? "-" : `${Math.round(rate * 100)}%`;
}

/** Gregorian year from the API → Buddhist-era year for display. */
export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + 543;
}

/** Buddhist-era year typed by the user → Gregorian year for the API. */
export function toGregorianYear(buddhistYear: number): number {
  return buddhistYear - 543;
}

/** `ภาคเรียนที่ 1/2569` */
export function formatTerm(term: number, gregorianYear: number): string {
  return `ภาคเรียนที่ ${term}/${toBuddhistYear(gregorianYear)}`;
}

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Calendar day in Asia/Bangkok as `YYYY-MM-DD` - for grouping by day. */
export function dayKey(value: string | Date): string {
  return dayKeyFormat.format(toDate(value));
}

/** `วันนี้` · `เมื่อวาน` · otherwise the long date, e.g. `29 กันยายน 2569`. */
export function formatDayLabel(value: string | Date, now: Date = new Date()): string {
  const key = dayKey(value);
  if (key === dayKey(now)) {
    return "วันนี้";
  }
  if (key === dayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))) {
    return "เมื่อวาน";
  }
  return formatDate(value, "long");
}
