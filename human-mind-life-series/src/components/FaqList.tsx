import type { FaqItem } from "@/content/books";
import { IconChevron } from "./icons";

/** Accessible accordion that works without JavaScript. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {items.map((item) => (
        <details key={item.q} className="group px-5 sm:px-7">
          <summary className="flex items-center justify-between gap-4 py-5 text-left font-medium text-ink">
            <span>{item.q}</span>
            <IconChevron className="shrink-0 text-gold transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <p className="pb-6 leading-relaxed text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
