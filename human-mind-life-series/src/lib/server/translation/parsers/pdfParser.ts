import "server-only";
import fs from "node:fs";
import type { Block, BookContent, BookParser } from "../bookContent";

type Item = { str: string; size: number; x: number; y: number; font: string };
type Line = { text: string; size: number; x: number; y: number; page: number; bulletFont: boolean; textX: number };

const BULLET_RE = /^[•●◦▪■‣⁃∙·\-–]\s*/;
const NUMBERED_RE = /^(\d{1,3})[.)]\s+/;

/**
 * Reads a text-based ("native") PDF and rebuilds its structure: headings
 * (from font size), paragraphs (from indents and spacing), bullet and
 * numbered lists, and pages without text (covers / image pages), which are
 * later copied unchanged. Running headers/footers and page numbers are
 * removed and regenerated in the translated book.
 */
export class PdfParser implements BookParser {
  async extractContent(filePath: string): Promise<BookContent> {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(fs.readFileSync(filePath));
    const task = pdfjs.getDocument({ data, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
    const doc = await task.promise;

    const pages: { lines: Line[]; height: number; width: number }[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      const items: Item[] = [];
      for (const it of tc.items) {
        if (!("str" in it)) continue;
        const size = Math.hypot(it.transform[2], it.transform[3]);
        items.push({ str: it.str, size, x: it.transform[4], y: it.transform[5], font: it.fontName });
      }
      pages.push({ lines: groupLines(items, p - 1), height: vp.height, width: vp.width });
      page.cleanup();
    }
    const pageSize = { width: pages[0]?.width ?? 432, height: pages[0]?.height ?? 648 };
    const meta = await doc.getMetadata().catch(() => null);
    const metaTitle = String((meta?.info as { Title?: string } | undefined)?.Title ?? "").trim();
    await task.destroy();

    removeRunningHeaders(pages);

    // Body text size = the size carrying the most characters.
    const weight = new Map<number, number>();
    for (const pg of pages) for (const l of pg.lines) weight.set(round(l.size), (weight.get(round(l.size)) ?? 0) + l.text.length);
    const bodySize = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
    const leftMargin = mode(pages.flatMap((pg) => pg.lines.filter((l) => round(l.size) === bodySize).map((l) => Math.round(l.x))));

    const blocks: Block[] = [];
    let para: { text: string; lastY: number; page: number } | null = null;
    let list: { block: Extract<Block, { type: "list" }>; itemX: number; lastY: number } | null = null;
    let heading: { block: Extract<Block, { type: "heading" }>; lastY: number; page: number } | null = null;
    const lineGap = bodySize * 1.55;

    const flushPara = () => {
      if (para && para.text.trim()) blocks.push({ type: "paragraph", text: tidy(para.text) });
      para = null;
    };
    const flushAll = () => {
      flushPara();
      list = null;
      heading = null;
    };

    pages.forEach((pg, pageIndex) => {
      if (pg.lines.length === 0) {
        flushAll();
        blocks.push({ type: "originalPage", pageIndex });
        return;
      }
      for (let i = 0; i < pg.lines.length; i++) {
        let line = pg.lines[i];
        const level = line.size >= bodySize * 1.6 ? 1 : line.size >= bodySize * 1.12 ? 2 : 0;

        if (level) {
          if (heading && heading.block.level === level && heading.page === pageIndex && heading.lastY - line.y < line.size * 1.6) {
            heading.block.text = joinText(heading.block.text, line.text);
            heading.lastY = line.y;
            continue;
          }
          flushAll();
          if (level === 1 && blocks.length && blocks[blocks.length - 1].type !== "originalPage") blocks.push({ type: "pageBreak" });
          const block = { type: "heading" as const, level: level as 1 | 2, text: line.text };
          blocks.push(block);
          heading = { block, lastY: line.y, page: pageIndex };
          continue;
        }
        heading = null;

        // A number on its own line ("1.") followed by the item text on the next line.
        if (/^\d{1,3}[.)]$/.test(line.text) && pg.lines[i + 1]) {
          const next = pg.lines[++i];
          line = { ...next, text: `${line.text} ${next.text}`, x: line.x };
        }

        const bullet = line.bulletFont || BULLET_RE.test(line.text);
        const numbered = NUMBERED_RE.exec(line.text);
        if (bullet || numbered) {
          flushPara();
          const text = bullet ? line.text.replace(BULLET_RE, "") : line.text.replace(NUMBERED_RE, "");
          const ordered = !!numbered && !bullet;
          if (!list || list.block.ordered !== ordered) {
            // A list that continues from the previous page joins the list it belongs to.
            const prev = blocks[blocks.length - 1];
            if (prev?.type === "list" && prev.ordered === ordered && i === 0) {
              list = { block: prev, itemX: line.textX, lastY: line.y };
            } else {
              list = { block: { type: "list", ordered, items: [] }, itemX: line.textX, lastY: line.y };
              blocks.push(list.block);
            }
          }
          list.block.items.push(tidy(text));
          list.itemX = line.textX;
          list.lastY = line.y;
          continue;
        }

        // Continuation of a list item: indented to the item's text, directly below it.
        if (list && Math.abs(line.x - list.itemX) < 4 && (list.lastY - line.y < lineGap * 1.2 || i === 0)) {
          const items = list.block.items;
          items[items.length - 1] = tidy(joinText(items[items.length - 1], line.text));
          list.lastY = line.y;
          continue;
        }
        list = null;

        const indented = line.x > leftMargin + 6;
        const bigGap = para !== null && para.page === pageIndex && para.lastY - line.y > lineGap * 1.25;
        if (!para || indented || bigGap) {
          flushPara();
          para = { text: line.text, lastY: line.y, page: pageIndex };
        } else {
          para.text = joinText(para.text, line.text);
          para.lastY = line.y;
          para.page = pageIndex;
        }
      }
      // Paragraphs may continue onto the next page; lists and headings do not.
      list = null;
      heading = null;
    });
    flushAll();

    const title = metaTitle || ((blocks.find((b) => b.type === "heading") as { text: string } | undefined)?.text ?? "");
    return { title, language: "en", pageSize, blocks, sourcePath: filePath };
  }
}

/**
 * True when the PDF has selectable text. A scanned / image-only PDF has (almost) none, and
 * translating it would only produce an untranslated copy, so it must be OCR'd first.
 */
export async function hasTextLayer(filePath: string, minCharsPerPage = 10): Promise<boolean> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(filePath)), useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  let chars = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    for (const it of (await page.getTextContent()).items) if ("str" in it) chars += it.str.trim().length;
    page.cleanup();
  }
  const pages = doc.numPages;
  await task.destroy();
  return chars >= pages * minCharsPerPage;
}

function round(n: number) {
  return Math.round(n * 2) / 2;
}

function mode(nums: number[]): number {
  const m = new Map<number, number>();
  for (const n of nums) m.set(n, (m.get(n) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

function groupLines(items: Item[], page: number): Line[] {
  const rows: Item[][] = [];
  for (const it of items.filter((i) => i.str !== "" || i.font)) {
    const row = rows.find((r) => Math.abs(r[0].y - it.y) < Math.max(2, it.size * 0.3));
    if (row) row.push(it);
    else rows.push([it]);
  }
  rows.sort((a, b) => b[0].y - a[0].y);
  const lines: Line[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    const textItems = row.filter((i) => i.str.trim() !== "");
    if (!textItems.length) continue;
    // A bullet drawn with a symbol font shows up as an empty/space item before the text.
    const first = row[0];
    const bulletFont = first.str.trim() === "" && first.font !== textItems[0].font && textItems[0].x - first.x > 8;
    let text = "";
    let prevEnd: number | null = null;
    for (const it of row) {
      if (prevEnd !== null && it.x - prevEnd > it.size * 0.15 && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
      text += it.str;
      prevEnd = it.x + it.str.length * it.size * 0.45;
    }
    text = text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    lines.push({
      text,
      size: Math.max(...textItems.map((i) => i.size)),
      x: bulletFont ? first.x : textItems[0].x,
      // Where the words start (after any bullet glyph, which may be a private-use symbol character).
      textX: (row.find((i) => /\p{L}/u.test(i.str)) ?? textItems[0]).x,
      y: row[0].y,
      page,
      bulletFont,
    });
  }
  return lines;
}

/** Removes lines (e.g. "Author | Title | 12") that repeat near the top/bottom of many pages, and bare page numbers. */
function removeRunningHeaders(pages: { lines: Line[]; height: number }[]) {
  const norm = (t: string) => t.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
  const counts = new Map<string, number>();
  const edge = (l: Line, h: number) => l.y < 72 || l.y > h - 72;
  for (const pg of pages) {
    const seen = new Set<string>();
    for (const l of pg.lines) if (edge(l, pg.height)) seen.add(norm(l.text));
    for (const k of seen) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const threshold = Math.max(3, Math.floor(pages.length * 0.3));
  for (const pg of pages) {
    pg.lines = pg.lines.filter((l) => !(edge(l, pg.height) && ((counts.get(norm(l.text)) ?? 0) >= threshold || /^\d{1,4}$/.test(l.text))));
  }
}

/** Joins two wrapped lines, undoing end-of-line hyphenation ("reinven-" + "tion"). */
function joinText(a: string, b: string): string {
  if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b;
  if (/-$/.test(a)) return a + b;
  return `${a} ${b}`;
}

function tidy(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}
