import Link from "next/link";
import { ALL_BOOKS } from "@/lib/products";
import { countWord } from "@/lib/text";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * The authors of the series. Each volume is written under its own pen
 * name; only names are shown — no invented photos, biographies or credentials.
 */
export function AuthorsGrid({ showLink = true, headingLevel = "h2" }: { showLink?: boolean; headingLevel?: "h1" | "h2" }) {
  const H = headingLevel;
  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">The Authors</p>
        <H className="mt-3 text-3xl sm:text-4xl">
          {countWord(ALL_BOOKS.length)} volumes. {countWord(ALL_BOOKS.length)} voices.
        </H>
        <p className="mt-4 text-lg leading-relaxed text-muted">Each book in the series is written under its own pen name, giving every volume a distinct voice and perspective.</p>
      </div>
      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_BOOKS.map((b) => (
          <li key={b.slug}>
            <Link href={`/books/${b.slug}`} className="card lift flex h-full flex-col items-center p-6 text-center">
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full border font-serif text-2xl"
                style={{ background: b.coverTheme.bg, borderColor: `${b.coverTheme.accent}88`, color: b.coverTheme.accent }}
                aria-hidden="true"
              >
                {initials(b.author)}
              </span>
              <span className="mt-5 font-serif text-xl text-ink">{b.author}</span>
              {b.volumeLabel && <span className="mt-2 text-xs font-semibold tracking-[0.16em] text-gold-dark uppercase">{b.volumeLabel}</span>}
              <span className="mt-1 text-sm leading-snug text-muted">{b.title}</span>
              {b.free && <span className="free-badge mt-3">Free Book</span>}
            </Link>
          </li>
        ))}
      </ul>
      {showLink && (
        <div className="mt-10 text-center">
          <Link href="/about" className="btn-outline">
            About the series &amp; authors
          </Link>
        </div>
      )}
    </div>
  );
}
