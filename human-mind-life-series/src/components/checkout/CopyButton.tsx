"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "../icons";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked — user can still select the text */
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-gold"
      aria-live="polite"
    >
      {copied ? <IconCheck width={14} className="text-success" /> : <IconCopy width={14} />}
      {copied ? "Copied" : label}
    </button>
  );
}
