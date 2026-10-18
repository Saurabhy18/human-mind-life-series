import { GENERAL_DISCLAIMER_PARAGRAPHS } from "@/content/disclaimer";

/**
 * The site-wide professional disclaimer, rendered as a self-contained, readable
 * block. Used on the FAQ page (and anywhere else the full disclaimer belongs).
 * Reuses the existing card styling so it matches the rest of the site.
 */
export function GeneralDisclaimer({ className = "" }: { className?: string }) {
  return (
    <aside aria-labelledby="disclaimer-title" className={`rounded-2xl border border-line bg-white p-6 text-sm leading-relaxed text-muted sm:p-8 ${className}`}>
      <h2 id="disclaimer-title" className="text-xl font-semibold text-ink sm:text-2xl">
        Disclaimer
      </h2>
      <div className="mt-3 space-y-3">
        {GENERAL_DISCLAIMER_PARAGRAPHS.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </aside>
  );
}
