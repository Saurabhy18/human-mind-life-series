"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { checkoutHref } from "@/config/languages";
import { IconArrowRight } from "../icons";
import { LanguageSelector } from "./LanguageSelector";

/**
 * Book page purchase box: language dropdown + Buy Now (the chosen language is carried to the payment page).
 * `translations` comes from the server: when translated editions aren't sold, it shows "English edition"
 * straight away (no dropdown, no translation wording, not even while loading).
 */
export function BookPurchase({
  slug,
  translations,
  tone = "light",
  buttonClass = "btn-primary flex-1 py-4 text-base",
  label = "Buy Now",
}: {
  slug: string;
  translations: boolean;
  tone?: "light" | "dark";
  buttonClass?: string;
  label?: string;
}) {
  const [lang, setLang] = useState("en");
  const onChange = useCallback((code: string) => setLang(code), []);
  const href = checkoutHref(slug, translations ? lang : "en");
  return (
    <div className="space-y-4">
      {translations ? (
        <LanguageSelector bookSlug={slug} value={lang} onChange={onChange} name="lang" tone={tone} />
      ) : (
        <p className={`text-sm ${tone === "dark" ? "text-white/70" : "text-muted"}`}>Language: English edition</p>
      )}
      <Link href={href} className={`${buttonClass} w-full`}>
        {label} <IconArrowRight />
      </Link>
    </div>
  );
}
