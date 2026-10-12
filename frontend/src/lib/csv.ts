/**
 * One CSV cell. Quotes when needed, and defuses values a spreadsheet would
 * run as a formula (OWASP CSV injection).
 */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * A student id like 6704101234 is all digits: Excel would show it as 6.7E+09
 * and drop leading zeros. `="6704101234"` keeps it as text. Only digit-only
 * values take this form, so it cannot smuggle in a formula.
 */
function textCell(value: string): string {
  return /^\d+$/.test(value) ? `="${value}"` : cell(value);
}

const BOM = String.fromCharCode(0xfeff);

/**
 * CSV for Excel: a UTF-8 BOM so Thai text opens correctly, and CRLF line ends.
 * `textColumns` = indexes of columns that hold ids, kept as text in Excel.
 */
export function toCsv(header: string[], rows: string[][], textColumns: number[] = []): string {
  const body = rows.map((row) => row.map((value, index) => (textColumns.includes(index) ? textCell(value) : cell(value))));
  return `${BOM}${[header.map(cell), ...body].map((row) => row.join(",")).join("\r\n")}\r\n`;
}

/** UTF-8 bytes of the BOM. */
const BOM_BYTES = new Uint8Array([0xef, 0xbb, 0xbf]);

/**
 * The file's parts, BOM always first as raw bytes. A CSV built on the server
 * reaches the browser as a component prop, and the leading BOM character does
 * not survive that trip - Excel then reads Thai text as the wrong encoding.
 */
export function csvFileParts(content: string): [Uint8Array<ArrayBuffer>, string] {
  return [BOM_BYTES, content.startsWith(BOM) ? content.slice(1) : content];
}

/** Hands the browser a CSV file to save. Browser only. */
export function downloadCsv(content: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob(csvFileParts(content), { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
