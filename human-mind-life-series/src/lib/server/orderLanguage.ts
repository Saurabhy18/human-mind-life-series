import "server-only";
import { translationOffered } from "@/config/env.server";
import { getBook } from "@/lib/products";
import { getBookSource } from "./translation/bookSource";
import { resolveTargetLanguage, SOURCE_LANGUAGE } from "./translation/languages";
import type { Language } from "./translation/googleTranslationService";

/** True when a book is sold in other languages: translated editions switched on (TRANSLATION_SALES_ENABLED) AND its private source PDF is on the server. */
export function bookIsTranslatable(slug: string): boolean {
  return translationOffered() && !!getBookSource(slug);
}

/**
 * Validates the language chosen for an order against Google's live list.
 * Books that cannot be translated (or bundles) are only sold in their original language.
 */
export async function validateOrderLanguage(productSlug: string, requested: unknown): Promise<{ ok: true; language: Language; source: string } | { ok: false; message: string }> {
  const book = getBook(productSlug);
  const source = book?.sourceLanguage ?? SOURCE_LANGUAGE.code;
  const code = typeof requested === "string" && requested.trim() ? requested.trim() : source;
  if (code.toLowerCase() === source.toLowerCase()) return { ok: true, language: { code: source, name: SOURCE_LANGUAGE.name }, source };
  if (!book || !bookIsTranslatable(book.slug)) return { ok: false, message: "This book is currently available in English only." };
  const language = await resolveTargetLanguage(code);
  if (!language) return { ok: false, message: "Please choose a language from the list." };
  return { ok: true, language, source };
}
