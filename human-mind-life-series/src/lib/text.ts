const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

/** 6 → "Six" (falls back to digits above twelve). */
export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}

/** Format a cell for CSV export, quoting and escaping strings and preventing formula injection. */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  // Prevent spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
