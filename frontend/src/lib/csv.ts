/**
 * One CSV cell. Quotes when needed, and defuses values a spreadsheet would
 * run as a formula (OWASP CSV injection).
 */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const BOM = String.fromCharCode(0xfeff);

/** CSV for Excel: a UTF-8 BOM so Thai text opens correctly, and CRLF line ends. */
export function toCsv(header: string[], rows: string[][]): string {
  return `${BOM}${[header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

/** Hands the browser a CSV file to save. Browser only. */
export function downloadCsv(content: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
