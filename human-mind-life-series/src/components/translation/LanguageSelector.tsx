"use client";

import { useEffect, useId, useState } from "react";

export type Language = { code: string; name: string };

let languagesPromise: Promise<Language[]> | null = null;
function loadLanguages(): Promise<Language[]> {
  if (!languagesPromise) {
    languagesPromise = fetch("/api/languages")
      .then((r) => r.json())
      .then((d: { success?: boolean; languages?: Language[] }) => (d.success && d.languages?.length ? d.languages : [{ code: "en", name: "English" }]))
      .catch(() => {
        languagesPromise = null;
        return [{ code: "en", name: "English" }];
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

/**
 * "Choose your language" dropdown, populated from GET /api/languages (Google
 * Cloud Translation's live list). For books that can't be translated it shows
 * "English edition" and submits "en".
 */
export function LanguageSelector({
  bookSlug,
  value,
  onChange,
  name = "targetLanguage",
  tone = "light",
  error,
}: {
  bookSlug: string;
  value: string;
  onChange: (code: string, language: Language | undefined) => void;
  name?: string;
  tone?: "light" | "dark";
  error?: string;
}) {
  const id = useId();
  const [languages, setLanguages] = useState<Language[] | null>(null);
  // Remembered per book, so switching book shows "loading" again without resetting state inside an effect.
  const [info, setInfo] = useState<{ slug: string; multilingual: boolean } | null>(null);
  const multilingual = info?.slug === bookSlug ? info.multilingual : null;

  useEffect(() => {
    let alive = true;
    isMultilingual(bookSlug).then(async (m) => {
      if (!alive) return;
      setInfo({ slug: bookSlug, multilingual: m });
      if (!m) {
        if (value !== "en") onChange("en", { code: "en", name: "English" });
        return;
      }
      const list = await loadLanguages();
      if (!alive) return;
      setLanguages(list);
      // A language that isn't offered falls back to English.
      if (!list.some((l) => l.code === value)) onChange("en", list[0]);
    });
    return () => {
      alive = false;
    };
  }, [bookSlug]); // eslint-disable-line react-hooks/exhaustive-deps -- only re-check when the book changes

  const dark = tone === "dark";
  if (multilingual === false) {
    return (
      <div>
        <input type="hidden" name={name} value="en" />
        <p className={`text-sm ${dark ? "text-white/70" : "text-muted"}`}>Language: English edition</p>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className={`label ${dark ? "text-white" : ""}`}>
        Choose your language
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
        {languages?.map((l) => (
          <option key={l.code} value={l.code}>
            {l.code === "en" ? `${l.name} (original)` : l.name}
          </option>
        ))}
      </select>
      <p className={`mt-1.5 text-xs ${dark ? "text-white/60" : "text-muted"}`}>Available in multiple languages. Translated editions are machine-translated with Google Cloud Translation.</p>
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
