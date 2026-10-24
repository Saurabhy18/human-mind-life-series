"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { DEFAULT_LANGUAGE, featuredLanguageName, type EbookLanguage } from "@/config/languages";

export type Language = EbookLanguage;

type LanguageList = { languages: Language[]; featured: string[] };
const ENGLISH_ONLY: LanguageList = { languages: [DEFAULT_LANGUAGE], featured: [] };

let languagesPromise: Promise<LanguageList> | null = null;
function loadLanguages(): Promise<LanguageList> {
  if (!languagesPromise) {
    languagesPromise = fetch("/api/languages")
      .then((r) => r.json())
      .then((d: { success?: boolean; languages?: Language[]; featured?: string[] }) =>
        d.success && d.languages?.length ? { languages: d.languages, featured: d.featured ?? [] } : ENGLISH_ONLY,
      )
      .catch(() => {
        languagesPromise = null;
        return ENGLISH_ONLY;
      });
  }
  return languagesPromise;
}

const multilingualCache = new Map<string, Promise<boolean>>();
function isMultilingual(slug: string): Promise<boolean> {
  if (!multilingualCache.has(slug)) {
    multilingualCache.set(
      slug,
      fetch(`/api/books/${encodeURIComponent(slug)}`)
        .then((r) => r.json())
        .then((d: { book?: { multilingual?: boolean } }) => !!d.book?.multilingual)
        .catch(() => false),
    );
  }
  return multilingualCache.get(slug)!;
}

/** Code → language name from the same list (the featured names from config/languages.ts until it has loaded). */
export function useLanguageNames(): (code: string) => string {
  const [list, setList] = useState<LanguageList | null>(null);
  useEffect(() => {
    let alive = true;
    loadLanguages().then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, []);
  return useCallback((code: string) => list?.languages.find((l) => l.code === code)?.name ?? featuredLanguageName(code), [list]);
}

/**
 * "Choose your ebook language" dropdown, populated from GET /api/languages
 * (Google Cloud Translation's live list; popular languages from
 * src/config/languages.ts first). Shows names, submits the language code.
 * English is the default. For books that can't be translated it shows
 * "English edition" and submits "en".
 */
export function LanguageSelector({
  bookSlug,
  value,
  onChange,
  name = "targetLanguage",
  tone = "light",
  error,
  label,
  hint = true,
  isMultilingual: isMultilingualProp,
}: {
  bookSlug: string;
  value: string;
  onChange: (code: string, language: Language | undefined) => void;
  name?: string;
  tone?: "light" | "dark";
  error?: string;
  label?: string;
  hint?: boolean;
  isMultilingual?: boolean;
}) {
  const id = useId();
  const [list, setList] = useState<LanguageList | null>(null);
  const languages = list?.languages ?? null;
  // Remembered per book, so switching book shows "loading" again without resetting state inside an effect.
  const [info, setInfo] = useState<{ slug: string; multilingual: boolean } | null>(() => isMultilingualProp !== undefined ? { slug: bookSlug, multilingual: isMultilingualProp } : null);
  const multilingual = info?.slug === bookSlug ? info.multilingual : (isMultilingualProp ?? null);

  useEffect(() => {
    let alive = true;
    const checkMultilingual = isMultilingualProp !== undefined
      ? Promise.resolve(isMultilingualProp)
      : isMultilingual(bookSlug);

    checkMultilingual.then(async (m) => {
      if (!alive) return;
      setInfo({ slug: bookSlug, multilingual: m });
      if (!m) {
        if (value !== DEFAULT_LANGUAGE.code) onChange(DEFAULT_LANGUAGE.code, DEFAULT_LANGUAGE);
        return;
      }
      const loaded = await loadLanguages();
      if (!alive) return;
      setList(loaded);
      // A language that isn't offered falls back to English.
      if (!loaded.languages.some((l) => l.code === value)) onChange(DEFAULT_LANGUAGE.code, loaded.languages[0]);
    });
    return () => {
      alive = false;
    };
  }, [bookSlug, isMultilingualProp]); // eslint-disable-line react-hooks/exhaustive-deps -- only re-check when the book changes

  const dark = tone === "dark";
  if (multilingual === false) {
    return (
      <div>
        <input type="hidden" name={name} value="en" />
        {label && <p className={`label ${dark ? "text-white" : ""}`}>{label}</p>}
        <p className={`text-sm ${dark ? "text-white/70" : "text-muted"}`}>{label ? "English edition (available in English only for now)" : "Language: English edition"}</p>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className={`label ${dark ? "text-white" : ""}`}>
        {label ?? "Choose your ebook language"}
      </label>
      <select
        id={id}
        name={name}
        className="input"
        value={value}
        disabled={!languages}
        onChange={(e) => onChange(e.target.value, languages?.find((l) => l.code === e.target.value))}
        aria-invalid={!!error || undefined}
      >
        {!languages && <option value={value}>Loading languages…</option>}
        {list && <LanguageOptions {...list} />}
      </select>
      {hint && <p className={`mt-1.5 text-xs ${dark ? "text-white/60" : "text-muted"}`}>Your ebook will be provided in the selected language. Translated editions are machine-translated with Google Cloud Translation.</p>}
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}

/** English (original) first, then "Popular languages", then every other supported language. */
function LanguageOptions({ languages, featured }: LanguageList) {
  const option = (l: Language) => (
    <option key={l.code} value={l.code}>
      {l.code === DEFAULT_LANGUAGE.code ? `${l.name} (original)` : l.name}
    </option>
  );
  const [original, ...others] = languages;
  const popularCodes = new Set(featured.filter((c) => c !== DEFAULT_LANGUAGE.code));
  const popular = featured.map((c) => others.find((l) => l.code === c && popularCodes.has(c))).filter((l): l is Language => !!l);
  if (popular.length === 0) return <>{languages.map(option)}</>;
  return (
    <>
      {option(original)}
      <optgroup label="Popular languages">{popular.map(option)}</optgroup>
      <optgroup label="All languages">{others.filter((l) => !popularCodes.has(l.code)).map(option)}</optgroup>
    </>
  );
}
