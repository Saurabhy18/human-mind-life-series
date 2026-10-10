import "server-only";
import { ENV } from "@/config/env.server";
import { logger } from "../logger";

export type Language = { code: string; name: string };

export interface TranslationService {
  readonly provider: "google" | "fake";
  /** Translates one piece of plain text. */
  translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string>;
  /** Translates several strings in ONE request (caller keeps the total under the per-request limit). */
  translateBatch(texts: string[], sourceLanguage: string, targetLanguage: string): Promise<string[]>;
  /** Google Document Translation: translates a PDF and keeps its layout, images and formatting. */
  translateDocument(pdf: Uint8Array, sourceLanguage: string, targetLanguage: string): Promise<Uint8Array>;
  /** Languages Google can translate INTO, with English display names. */
  getSupportedLanguages(): Promise<Language[]>;
}

// gRPC status codes worth retrying: DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED, ABORTED, INTERNAL, UNAVAILABLE.
const RETRYABLE = new Set([4, 8, 10, 13, 14]);

export async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3, baseMs = 1000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = (err as { code?: number }).code;
      const retryable = code === undefined || RETRYABLE.has(code);
      if (!retryable || i === attempts - 1) break;
      const wait = baseMs * 2 ** i + Math.floor(Math.random() * 250);
      logger.warn(`${label} failed (attempt ${i + 1}/${attempts}, code ${code ?? "n/a"}); retrying in ${wait} ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

/**
 * The few v3 TranslationServiceClient methods we use. Declared locally so the
 * TypeScript compiler doesn't have to load the SDK's very large generated types.
 */
type V3Client = {
  locationPath(project: string, location: string): string;
  translateText(req: {
    parent: string;
    contents: string[];
    mimeType: string;
    sourceLanguageCode: string;
    targetLanguageCode: string;
  }): Promise<[{ translations?: { translatedText?: string | null }[] | null }, ...unknown[]]>;
  translateDocument(req: {
    parent: string;
    sourceLanguageCode: string;
    targetLanguageCode: string;
    documentInputConfig: { content: Uint8Array; mimeType: string };
    documentOutputConfig: { mimeType: string };
    isTranslateNativePdfOnly: boolean;
  }): Promise<[{ documentTranslation?: { byteStreamOutputs?: (Uint8Array | string)[] | null } | null }, ...unknown[]]>;
  getSupportedLanguages(req: { parent: string; displayLanguageCode: string }): Promise<
    [{ languages?: { languageCode?: string | null; displayName?: string | null; supportTarget?: boolean | null }[] | null }, ...unknown[]]
  >;
};

/** Real implementation — official @google-cloud/translate v3 SDK (Cloud Translation Advanced). */
class GoogleTranslationService implements TranslationService {
  readonly provider = "google" as const;
  // Lazily created so the SDK is only loaded on the server when actually needed.
  private client: V3Client | null = null;

  private async getClient() {
    if (!this.client) {
      // Loaded at runtime only; credentials come from Application Default Credentials
      // (gcloud auth / service account / workload identity) — never from source code.
      // A plain import (no webpackIgnore) so the build includes the SDK in standalone output (Hostinger builds standalone).
      const mod = (await import("@google-cloud/translate")) as unknown as { v3: { TranslationServiceClient: new () => V3Client } };
      this.client = new mod.v3.TranslationServiceClient();
    }
    return this.client;
  }

  private parent(client: V3Client) {
    return client.locationPath(ENV.translation.projectId, ENV.translation.location);
  }

  async translateText(text: string, source: string, target: string) {
    const [out] = await this.translateBatch([text], source, target);
    return out;
  }

  async translateBatch(texts: string[], source: string, target: string) {
    if (texts.length === 0) return [];
    const client = await this.getClient();
    const [res] = await withRetry("translateText", () =>
      client.translateText({ parent: this.parent(client), contents: texts, mimeType: "text/plain", sourceLanguageCode: source, targetLanguageCode: target }),
    );
    const out = (res.translations ?? []).map((t) => t.translatedText ?? "");
    if (out.length !== texts.length) throw new Error(`translateText returned ${out.length} results for ${texts.length} inputs`);
    return out;
  }

  async translateDocument(pdf: Uint8Array, source: string, target: string) {
    const client = await this.getClient();
    const [res] = await withRetry("translateDocument", () =>
      client.translateDocument({
        parent: this.parent(client),
        sourceLanguageCode: source,
        targetLanguageCode: target,
        documentInputConfig: { content: pdf, mimeType: "application/pdf" },
        documentOutputConfig: { mimeType: "application/pdf" },
        // Native (text-based) PDFs: allows up to 300 pages per request.
        isTranslateNativePdfOnly: true,
      }),
    );
    const out = res.documentTranslation?.byteStreamOutputs?.[0];
    if (!out || !out.length) throw new Error("translateDocument returned no document");
    return typeof out === "string" ? Buffer.from(out, "base64") : new Uint8Array(out);
  }

  async getSupportedLanguages() {
    const client = await this.getClient();
    const [res] = await withRetry("getSupportedLanguages", () => client.getSupportedLanguages({ parent: this.parent(client), displayLanguageCode: "en" }));
    return (res.languages ?? [])
      .filter((l) => l.supportTarget && l.languageCode)
      .map((l) => ({ code: l.languageCode as string, name: (l.displayName || l.languageCode) as string }));
  }
}

/**
 * LOCAL TESTING ONLY (TRANSLATION_PROVIDER=fake). Never used in production —
 * env.server.ts turns it off there. It marks text as "[fr] …" so the whole
 * pipeline can be exercised without Google credentials or cost.
 */
export class FakeTranslationService implements TranslationService {
  readonly provider = "fake" as const;
  static readonly LANGUAGES: Language[] = [
    { code: "en", name: "English" }, { code: "fr", name: "French" }, { code: "es", name: "Spanish" }, { code: "de", name: "German" },
    { code: "hi", name: "Hindi" }, { code: "ja", name: "Japanese" }, { code: "zh-CN", name: "Chinese (Simplified)" },
    { code: "zh-TW", name: "Chinese (Traditional)" }, { code: "ar", name: "Arabic" }, { code: "ta", name: "Tamil" },
  ];
  /** Test hooks. */
  failNext = 0;
  calls = { text: 0, chars: 0, document: 0 };

  private maybeFail() {
    if (this.failNext > 0) {
      this.failNext--;
      throw Object.assign(new Error("Simulated Google outage"), { code: 14 });
    }
  }
  async translateText(text: string, s: string, t: string) {
    return (await this.translateBatch([text], s, t))[0];
  }
  async translateBatch(texts: string[], _s: string, target: string) {
    this.maybeFail();
    this.calls.text++;
    this.calls.chars += texts.reduce((n, x) => n + [...x].length, 0);
    const sample: Record<string, string> = { hi: "अनुवाद", ja: "翻訳", "zh-CN": "翻译", "zh-TW": "翻譯", ar: "ترجمة", ta: "மொழிபெயர்ப்பு" };
    return texts.map((x) => `[${target}${sample[target] ? " " + sample[target] : ""}] ${x}`);
  }
  async translateDocument(pdf: Uint8Array, _s: string, target: string) {
    this.maybeFail();
    this.calls.document++;
    // Stamp each page so tests can see the document went through the "translator".
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const doc = await PDFDocument.load(pdf);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (const page of doc.getPages()) page.drawText(`[translated: ${target}]`, { x: 12, y: 12, size: 7, font, color: rgb(0.6, 0.1, 0.1) });
    return doc.save();
  }
  async getSupportedLanguages() {
    return FakeTranslationService.LANGUAGES.slice();
  }
}

let instance: TranslationService | null | undefined;

/** The configured translator, or null when translation is not configured (site then offers English only). */
export function getTranslationService(): TranslationService | null {
  if (instance === undefined) {
    instance = ENV.translation.provider === "google" ? new GoogleTranslationService() : ENV.translation.provider === "fake" ? new FakeTranslationService() : null;
  }
  return instance;
}

/** Tests only. */
export function setTranslationServiceForTests(svc: TranslationService | null) {
  instance = svc;
}
