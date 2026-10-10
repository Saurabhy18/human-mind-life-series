import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import { ENV, type TranslationStrategy } from "@/config/env.server";
import { getBook } from "@/lib/products";
import { getStorage } from "../storageService";
import { translatableSegments } from "./bookContent";
import { translateSegments } from "./chunker";
import type { TranslationService } from "./googleTranslationService";
import { PdfParser } from "./parsers/pdfParser";
import { PdfBookGenerator } from "./generators/pdfBookGenerator";

export type Phase = "PREPARING" | "TRANSLATING" | "GENERATING" | "STORING";
export type ProgressFn = (phase: Phase, percent: number) => void | Promise<void>;

export type TranslateBookInput = {
  jobId: number;
  bookSlug: string;
  sourceFile: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceVersion: string;
  strategy: TranslationStrategy;
};

export type TranslateBookResult = {
  storageKey: string;
  bytes: number;
  sha256: string;
  charsTranslated: number;
  pagesTranslated: number;
  estCostUsd: number;
};

const MAX_REQUEST_BYTES = 19 * 1024 * 1024; // Google Document Translation: 20 MB per request.

/**
 * Translates one book into one language and stores the result privately.
 *   document strategy: PDF → split into parts → Google Document Translation (keeps layout, images, fonts) → merge
 *   text strategy:     PDF → extract structure → chunk → translate → rebuild PDF (keeps cover/image pages)
 * Returns the private storage key — never a public URL.
 */
export async function translateBook(svc: TranslationService, input: TranslateBookInput, progress: ProgressFn): Promise<TranslateBookResult> {
  await progress("PREPARING", 2);
  const source = new Uint8Array(fs.readFileSync(input.sourceFile));

  let bytes: Uint8Array;
  let chars = 0;
  let pages = 0;
  if (input.strategy === "document") {
    ({ bytes, pages } = await translateByDocument(svc, source, input, progress));
  } else {
    ({ bytes, chars } = await translateByText(svc, input, progress));
  }

  await progress("STORING", 96);
  const storageKey = `translations/${input.bookSlug}/${input.targetLanguage}/${input.sourceVersion}.pdf`;
  await getStorage().put(storageKey, bytes, "application/pdf");
  const estCostUsd =
    input.strategy === "document"
      ? pages * ENV.translation.pricePerPageUsd
      : (chars / 1_000_000) * ENV.translation.pricePerMillionCharsUsd;
  return {
    storageKey,
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    charsTranslated: chars,
    pagesTranslated: pages,
    estCostUsd: Math.round(estCostUsd * 10000) / 10000,
  };
}

async function translateByDocument(svc: TranslationService, source: Uint8Array, input: TranslateBookInput, progress: ProgressFn) {
  const { PDFDocument } = await import("pdf-lib");
  const src = await PDFDocument.load(source);
  const total = src.getPageCount();
  const out = await PDFDocument.create();

  // Plan parts of at most N pages (and under 20 MB), so books of any length fit Google's per-request limits.
  const parts: number[][] = [];
  for (let start = 0; start < total; start += ENV.translation.docPagesPerRequest) {
    parts.push(Array.from({ length: Math.min(ENV.translation.docPagesPerRequest, total - start) }, (_, i) => start + i));
  }

  let done = 0;
  const translatePart = async (pageIdx: number[]): Promise<void> => {
    const part = await PDFDocument.create();
    for (const p of await part.copyPages(src, pageIdx)) part.addPage(p);
    const partBytes = await part.save();
    if (partBytes.length > MAX_REQUEST_BYTES && pageIdx.length > 1) {
      const mid = Math.ceil(pageIdx.length / 2);
      await translatePart(pageIdx.slice(0, mid));
      await translatePart(pageIdx.slice(mid));
      return;
    }
    const translated = await PDFDocument.load(await svc.translateDocument(partBytes, input.sourceLanguage, input.targetLanguage));
    for (const p of await out.copyPages(translated, translated.getPageIndices())) out.addPage(p);
    done += pageIdx.length;
    await progress("TRANSLATING", 5 + Math.round((done / total) * 85));
  };
  for (const part of parts) await translatePart(part);

  await progress("GENERATING", 92);
  const book = getBook(input.bookSlug);
  out.setTitle(src.getTitle() || book?.title || input.bookSlug);
  out.setLanguage(input.targetLanguage);
  return { bytes: await out.save(), pages: total };
}

async function translateByText(svc: TranslationService, input: TranslateBookInput, progress: ProgressFn) {
  const content = await new PdfParser().extractContent(input.sourceFile);
  await progress("TRANSLATING", 8);

  const segments = translatableSegments(content);
  const { translations, chars } = await translateSegments(
    svc,
    segments.map((s) => s.get()),
    input.sourceLanguage,
    input.targetLanguage,
    ENV.translation.textCharsPerRequest,
    (f) => progress("TRANSLATING", 8 + Math.round(f * 77)),
  );
  segments.forEach((s, i) => s.set(translations[i]));
  content.language = input.targetLanguage;

  await progress("GENERATING", 88);
  const bytes = await new PdfBookGenerator().render(content);
  return { bytes, chars };
}
