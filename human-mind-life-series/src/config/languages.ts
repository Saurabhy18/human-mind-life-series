/**
 * EBOOK LANGUAGES — the one place to manage which languages are featured.
 *
 * Customers can order any language Google Cloud Translation supports (fetched
 * live from Google and validated on the server). The languages below are:
 *   1. shown first in the "Choose your ebook language" dropdown, under "Popular languages";
 *   2. the fallback list if Google's language list can't be loaded.
 *
 * To feature another language, add it here with its Google Cloud Translation
 * code (https://cloud.google.com/translate/docs/languages). Codes that Google
 * doesn't currently support are ignored automatically.
 *
 * Safe for the browser: contains no secrets.
 */
export type EbookLanguage = { code: string; name: string };

/** Every book is written in English; it is always the default selection. */
export const DEFAULT_LANGUAGE: EbookLanguage = { code: "en", name: "English" };

export const FEATURED_LANGUAGES: readonly EbookLanguage[] = [
  DEFAULT_LANGUAGE,
  { code: "hi", name: "Hindi" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional)" },
  { code: "ar", name: "Arabic" },
  { code: "ru", name: "Russian" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "bn", name: "Bengali" },
  { code: "mr", name: "Marathi" },
  { code: "gu", name: "Gujarati" },
  { code: "kn", name: "Kannada" },
  { code: "ml", name: "Malayalam" },
  { code: "pa", name: "Punjabi" },
  { code: "ur", name: "Urdu" },
  { code: "tr", name: "Turkish" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "vi", name: "Vietnamese" },
  { code: "th", name: "Thai" },
  { code: "id", name: "Indonesian" },
];

/** Shape of a Google language code ("hi", "zh-CN", "pa-Arab"); real support is checked on the server. */
export const LANGUAGE_CODE_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** Book page → payment page link, carrying a non-default language as ?lang=xx. */
export function checkoutHref(slug: string, lang: string): string {
  return `/checkout/${slug}${lang && lang !== DEFAULT_LANGUAGE.code ? `?lang=${encodeURIComponent(lang)}` : ""}`;
}

/** English name for a language code from the list above (falls back to the code). */
export function featuredLanguageName(code: string): string {
  return FEATURED_LANGUAGES.find((l) => l.code.toLowerCase() === code.toLowerCase())?.name ?? code;
}
