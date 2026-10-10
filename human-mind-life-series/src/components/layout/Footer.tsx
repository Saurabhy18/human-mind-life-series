import Link from "next/link";
import { BUSINESS_EMAIL, CONFIG, isPlaceholder } from "@/config/site.config";
import { ALL_BOOKS } from "@/lib/products";
import { countWord } from "@/lib/text";
import { SocialLinks } from "../SocialLinks";

export function Footer() {
  const year = new Date().getFullYear();
  const names = ALL_BOOKS.map((b) => b.author);
  const authorList = `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return (
    <footer className="bg-ink text-white/75">
      <div className="container-page grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="font-sans text-[0.6rem] font-semibold tracking-[0.28em] text-gold-light uppercase">The</p>
          <p className="font-serif text-2xl text-white">
            Human Mind <span className="text-gold">&amp;</span> Life Series
          </p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            Explore the human mind. Understand life. Understand yourself. A {countWord(ALL_BOOKS.length).toLowerCase()}-volume series by {authorList}.
          </p>
          <div className="mt-6">
            <SocialLinks tone="light" />
          </div>
        </div>

        <nav aria-label="Books" className="lg:col-span-3">
          <h2 className="font-sans text-xs font-semibold tracking-[0.18em] text-gold-light uppercase">The Books</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {ALL_BOOKS.map((b) => (
              <li key={b.slug}>
                <Link href={`/books/${b.slug}`} className="hover:text-white">
                  {b.volumeLabel ? `Vol. ${b.volume} — ${b.title}` : b.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Information" className="lg:col-span-2">
          <h2 className="font-sans text-xs font-semibold tracking-[0.18em] text-gold-light uppercase">Information</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/about" className="hover:text-white">About</Link></li>
            <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            <li><Link href="/books" className="hover:text-white">All Books</Link></li>
          </ul>
        </nav>

        <nav aria-label="Legal" className="lg:col-span-3">
          <h2 className="font-sans text-xs font-semibold tracking-[0.18em] text-gold-light uppercase">Policies</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/privacy-policy" className="hover:text-white">Privacy Policy</Link></li>
            <li><Link href="/terms-and-conditions" className="hover:text-white">Terms &amp; Conditions</Link></li>
            <li><Link href="/refund-policy" className="hover:text-white">Refund &amp; Cancellation Policy</Link></li>
          </ul>
          {!isPlaceholder(BUSINESS_EMAIL) && (
            <p className="mt-6 text-sm">
              <a href={`mailto:${BUSINESS_EMAIL}`} className="hover:text-white">{BUSINESS_EMAIL}</a>
            </p>
          )}
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {CONFIG.PUBLISHER_NAME}. All rights reserved.</p>
          <p>Secure UPI payments · We never ask for your UPI PIN, OTP or bank password.</p>
        </div>
      </div>
    </footer>
  );
}
