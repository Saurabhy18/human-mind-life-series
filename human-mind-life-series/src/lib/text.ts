const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

/** 6 → "Six" (falls back to digits above twelve). */
export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}
