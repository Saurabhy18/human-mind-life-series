import { CONFIG } from "@/config/site.config";
import type { Book } from "@/lib/products";
import { FreeBookForm } from "./FreeBookForm";

export function FreeBadge({ className = "" }: { className?: string }) {
  return <span className={`free-badge ${className}`}>Free Book</span>;
}

/** The "GET FREE BOOK" section (anchor #get-free) used on a free book's page and ad landing page. */
export function FreeBookSection({ book, tone = "light" }: { book: Book; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <section
      id="get-free"
      aria-labelledby="get-free-title"
      className={`scroll-mt-28 rounded-3xl p-6 sm:p-10 ${dark ? "bg-ink text-white" : "border border-success/25 bg-gradient-to-b from-success/[0.06] to-white"}`}
    >
      <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:gap-12">
        <div>
          <FreeBadge />
          <h2 id="get-free-title" className={`mt-4 text-3xl leading-tight sm:text-4xl ${dark ? "text-white" : ""}`}>
            FREE
          </h2>
          <p className={`mt-2 font-serif text-2xl leading-snug ${dark ? "text-white/90" : "text-ink"}`}>Get {book.title} at no cost.</p>
          <ul className={`mt-6 space-y-2.5 text-sm ${dark ? "text-white/75" : "text-ink/80"}`}>
            <li>✓ No payment, no QR code, no transaction ID</li>
            <li>✓ Just your name and email address</li>
            <li>✓ {CONFIG.BOOK_FORMAT}, read on any device</li>
            {book.adultsOnly && <li>✓ For adult readers (18+)</li>}
          </ul>
        </div>
        <div className={dark ? "" : "rounded-2xl border border-line bg-white p-5 sm:p-7"}>
          <FreeBookForm
            book={{ slug: book.slug, label: book.label, title: book.title }}
            adultsOnly={book.adultsOnly}
            linkLimit={CONFIG.FREE_DOWNLOAD_LIMIT}
            tone={tone}
          />
        </div>
      </div>
    </section>
  );
}
