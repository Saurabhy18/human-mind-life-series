import "server-only";
import type { TranslationService } from "./googleTranslationService";

const cp = (s: string) => [...s].length;

/** Splits text longer than `limit` code points at sentence (then word) boundaries. */
export function splitLongText(text: string, limit: number): string[] {
  if (cp(text) <= limit) return [text];
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]+["”’)]*\s*|[^.!?。！？]+$/g) ?? [text];
  const parts: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cp(s) > limit) {
      if (cur) {
        parts.push(cur);
        cur = "";
      }
      // A single huge "sentence": fall back to word boundaries.
      let piece = "";
      for (const w of s.split(/(\s+)/)) {
        if (cp(piece + w) > limit && piece) {
          parts.push(piece);
          piece = "";
        }
        piece += w;
      }
      if (piece) parts.push(piece);
    } else if (cp(cur + s) > limit) {
      parts.push(cur);
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Groups pieces into requests whose total size stays within `limit` code points (Google: ≤ 5K recommended, 30K max). */
export function batchByChars(pieces: string[], limit: number): number[][] {
  const batches: number[][] = [];
  let cur: number[] = [];
  let size = 0;
  pieces.forEach((p, i) => {
    const n = cp(p);
    if (cur.length && size + n > limit) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(i);
    size += n;
  });
  if (cur.length) batches.push(cur);
  return batches;
}

/**
 * Translates many strings efficiently: long strings are split, everything
 * is grouped into right-sized requests, and the results are reassembled in
 * the original order. Reports progress (0–1) after each request.
 */
export async function translateSegments(
  svc: TranslationService,
  texts: string[],
  source: string,
  target: string,
  limit: number,
  onProgress?: (fraction: number) => void | Promise<void>,
): Promise<{ translations: string[]; chars: number }> {
  const pieces: string[] = [];
  const owner: number[] = [];
  texts.forEach((t, i) => {
    for (const piece of splitLongText(t, limit)) {
      pieces.push(piece);
      owner.push(i);
    }
  });
  const out = new Array<string>(pieces.length);
  const batches = batchByChars(pieces, limit);
  let done = 0;
  for (const batch of batches) {
    const res = await svc.translateBatch(batch.map((i) => pieces[i]), source, target);
    batch.forEach((pieceIndex, k) => (out[pieceIndex] = res[k]));
    done++;
    await onProgress?.(done / batches.length);
  }
  const translations = texts.map(() => [] as string[]);
  out.forEach((t, i) => translations[owner[i]].push(t));
  const joiner = /^(zh|ja|th|lo|km|my)/.test(target) ? "" : " ";
  return { translations: translations.map((parts) => parts.join(joiner)), chars: pieces.reduce((n, p) => n + cp(p), 0) };
}
