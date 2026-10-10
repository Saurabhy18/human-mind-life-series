"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { IconArrowRight } from "../icons";
import { LanguageSelector } from "./LanguageSelector";

/** Book page purchase box: language dropdown + Buy Now (the chosen language is carried to the payment page). */
export function BookPurchase({ slug, tone = "light", buttonClass = "btn-primary flex-1 py-4 text-base", label = "Buy Now" }: { slug: string; tone?: "light" | "dark"; buttonClass?: string; label?: string }) {
  const [lang, setLang] = useState("en");
  const onChange = useCallback((code: string) => setLang(code), []);
  const href = `/checkout/${slug}${lang !== "en" ? `?lang=${encodeURIComponent(lang)}` : ""}`;
  return (
    <div className="space-y-4">
      <LanguageSelector bookSlug={slug} value={lang} onChange={onChange} name="lang" tone={tone} />
      <Link href={href} className={`${buttonClass} w-full`}>
        {label} <IconArrowRight />
      </Link>
    </div>
  );
}
