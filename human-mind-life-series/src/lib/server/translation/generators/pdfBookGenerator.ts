import "server-only";
import fs from "node:fs";
import { ENV } from "@/config/env.server";
import type { Block, BookContent, BookGenerator } from "../bookContent";
import { isRtl } from "../languages";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function blockHtml(b: Block): string {
  switch (b.type) {
    case "heading":
      return `<h${b.level}>${esc(b.text)}</h${b.level}>`;
    case "paragraph":
      return `<p>${esc(b.text)}</p>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      return `<${tag}>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}>`;
    }
    case "pageBreak":
      return `<div class="pb"></div>`;
    default:
      return "";
  }
}

/** HTML for one run of text blocks, laid out to the source book's trim size. */
export function bookHtml(content: BookContent, blocks: Block[]): string {
  const lang = content.language;
  const dir = isRtl(lang) ? "rtl" : "ltr";
  return `<!doctype html><html lang="${esc(lang)}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(content.title)}</title>
<style>
  @page { size: ${content.pageSize.width}pt ${content.pageSize.height}pt; margin: 54pt 50pt 60pt 50pt; }
  html { -webkit-print-color-adjust: exact; }
  body { margin: 0; font-family: "Noto Serif", "Noto Sans", Georgia, "Times New Roman", serif; font-size: 10.5pt; line-height: 1.55; color: #1a1a1a;
         text-align: start; hyphens: auto; overflow-wrap: anywhere; }
  :lang(zh), :lang(ja), :lang(ko) { font-family: "Noto Serif CJK SC", "Noto Sans CJK SC", "Microsoft YaHei", "Yu Gothic", "Malgun Gothic", sans-serif; line-height: 1.75; }
  h1 { font-size: 20pt; line-height: 1.25; margin: 0 0 18pt; text-align: center; font-weight: 700; break-after: avoid; }
  h2 { font-size: 12.5pt; margin: 16pt 0 6pt; font-weight: 700; break-after: avoid; }
  h3 { font-size: 11pt; margin: 12pt 0 4pt; break-after: avoid; }
  p { margin: 0 0 7pt; text-indent: 12pt; orphans: 2; widows: 2; }
  h1 + p, h2 + p, h3 + p { text-indent: 0; }
  ul, ol { margin: 0 0 8pt; padding-inline-start: 18pt; }
  li { margin: 0 0 3pt; }
  .pb { break-after: page; }
</style></head><body>${blocks.map(blockHtml).join("\n")}</body></html>`;
}

/**
 * Builds the translated PDF: text is laid out by Chromium (correct shaping
 * for Indic, Arabic/RTL and CJK scripts, given the right fonts on the
 * server), and pages of the original without text — the cover and image
 * pages — are copied over unchanged.
 */
export class PdfBookGenerator implements BookGenerator {
  async generate(content: BookContent, outputPath: string): Promise<string> {
    const bytes = await this.render(content);
    fs.writeFileSync(outputPath, bytes);
    return outputPath;
  }

  async render(content: BookContent): Promise<Uint8Array> {
    const { chromium } = await import("playwright-core");
    const { PDFDocument } = await import("pdf-lib");

    // Split into runs: text blocks become rendered pages, originalPage blocks are copied.
    const runs: ({ kind: "html"; blocks: Block[] } | { kind: "original"; pageIndex: number })[] = [];
    for (const b of content.blocks) {
      if (b.type === "originalPage") runs.push({ kind: "original", pageIndex: b.pageIndex });
      else {
        const last = runs[runs.length - 1];
        if (last?.kind === "html") last.blocks.push(b);
        else runs.push({ kind: "html", blocks: [b] });
      }
    }
    // Drop page breaks at the very start of a run (they would create blank pages).
    for (const r of runs) if (r.kind === "html") while (r.blocks[0]?.type === "pageBreak") r.blocks.shift();

    const browser = await chromium.launch({ executablePath: ENV.translation.chromiumPath || undefined, headless: true, args: ["--no-sandbox"] });
    try {
      const out = await PDFDocument.create();
      const source = await PDFDocument.load(fs.readFileSync(content.sourcePath));
      const page = await browser.newPage();
      const footer = `<div style="font-size:7.5pt;width:100%;text-align:center;color:#666;font-family:sans-serif">${esc(content.title)} · <span class="pageNumber"></span></div>`;
      for (const run of runs) {
        if (run.kind === "original") {
          const [copied] = await out.copyPages(source, [run.pageIndex]);
          out.addPage(copied);
          continue;
        }
        if (!run.blocks.length) continue;
        await page.setContent(bookHtml(content, run.blocks), { waitUntil: "load" });
        const pdf = await page.pdf({
          width: `${content.pageSize.width / 72}in`,
          height: `${content.pageSize.height / 72}in`,
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: true,
          headerTemplate: "<span></span>",
          footerTemplate: footer,
        });
        const part = await PDFDocument.load(pdf);
        for (const p of await out.copyPages(part, part.getPageIndices())) out.addPage(p);
      }
      out.setTitle(content.title);
      out.setLanguage(content.language);
      out.setProducer("The Human Mind & Life Series");
      return await out.save();
    } finally {
      await browser.close();
    }
  }
}
