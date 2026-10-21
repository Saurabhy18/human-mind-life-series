import Link from "next/link";
import type { Metadata } from "next";
import { CONFIG } from "@/config/site.config";
import { SERIES } from "@/content/books";
import { PACKAGES } from "@/config/packages";
import { ALL_BOOKS, BUNDLE_SLUG, PAID_BOOKS, bookActionHref, bookActionLabel, bundleEnabled, bundlePrice, formatINR, individualTotal, packageCheckoutHref, volumeRange } from "@/lib/products";
import { getSiteCatalog } from "@/lib/server/books";
import { pageMetadata } from "@/lib/seo";
import { BookCover } from "@/components/BookCover";
import { OfferCountdown } from "@/components/OfferCountdown";
import { BookPrice } from "@/components/BookPrice";
import { HowToBuy } from "@/components/HowToBuy";
import { IconArrowRight, IconCheck } from "@/components/icons";

export const dynamic = "force-dynamic";

/** AD LANDING PAGE for the whole series: /lp/series */
export const metadata: Metadata = pageMetadata({
  title: `${CONFIG.SITE_NAME} — Six Books About the Human Mind & Life`,
  description: SERIES.shortDescription,
  path: "/lp/series",
  noIndex: true,
  absoluteTitle: true,
});

export default function SeriesLandingPage() {
  const { allBooks, paidBooks, freeBooks } = getSiteCatalog();
  return (
    <>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(179,139,69,0.28),transparent_70%)]" />
        <div className="container-page relative py-14 text-center sm:py-20">
          <p className="eyebrow text-gold-light">A Six-Volume Book Series · One Free Book</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl leading-[1.08] text-white sm:text-6xl">
            Explore the Human Mind. Understand Life. Understand Yourself.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/75">{SERIES.shortDescription}</p>
          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-5">
            {allBooks.map((b) => (
              <Link key={b.slug} href={`/lp/${b.slug}`} className="lift block">
                <BookCover book={b} size="sm" />
              </Link>
            ))}
          </div>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            {bundleEnabled() ? (
              <Link href={`/checkout/${BUNDLE_SLUG}`} className="btn-gold px-10 py-4 text-base">
                Get all {paidBooks.length} paid volumes for {formatINR(bundlePrice())} <IconArrowRight />
              </Link>
            ) : (
              <a href="#volumes" className="btn-gold px-10 py-4 text-base">
                Choose your book <IconArrowRight />
              </a>
            )}
          </div>
          {freeBooks.map((fb) => (
            <p key={fb.slug} className="mt-5 text-white/80">
              Start with {fb.title} for FREE, then explore the complete series.{" "}
              <Link href={`/lp/${fb.slug}#get-free`} className="font-semibold text-emerald-300 underline underline-offset-2">
                GET FREE BOOK
              </Link>
            </p>
          ))}
          {bundleEnabled() && (
            <p className="mt-3 text-sm text-white/60">
              Individually <span className="line-through">{formatINR(individualTotal())}</span> ·{" "}
              <Link href={packageCheckoutHref("three_book_bundle")} className="underline underline-offset-2 hover:text-white">
                or any {PACKAGES.three_book_bundle.books} books for {formatINR(PACKAGES.three_book_bundle.price)}
              </Link>
            </p>
          )}
        </div>
      </section>

      <section id="volumes" className="container-page scroll-mt-4 py-16 sm:py-20">
        <h2 className="text-center text-3xl sm:text-4xl">The six volumes</h2>
        <OfferCountdown variant="banner" scope={volumeRange(PAID_BOOKS)} className="mx-auto mt-10 max-w-4xl" />
        <div className="mx-auto mt-6 max-w-4xl space-y-4">
          {ALL_BOOKS.map((b) => (
            <article key={b.slug} className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-5">
                <div className="w-20 shrink-0">
                  <BookCover book={b} size="xs" />
                </div>
                <div>
                  <p className="eyebrow">
                    {b.volumeLabel}
                    {b.free && <span className="free-badge ml-2 px-2 py-0.5 text-[0.6rem]">Free</span>}
                  </p>
                  <h3 className="mt-1 text-xl">{b.title}</h3>
                  <p className="text-xs text-muted">by {b.author}</p>
                  <p className="mt-1 text-sm text-muted">{b.tagline}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <p className={`font-serif text-2xl ${b.free ? "font-semibold text-success" : ""}`}><BookPrice book={b} align="end" /></p>
                <div className="flex gap-2">
                  <Link href={`/lp/${b.slug}`} className="btn-outline px-4 py-2.5">Details</Link>
                  <Link href={b.free ? `/lp/${b.slug}#get-free` : bookActionHref(b)} className={`${b.free ? "btn-free" : "btn-primary"} px-4 py-2.5`}>
                    {bookActionLabel(b)}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-cream/70 py-16 sm:py-20">
        <div className="container-page">
          <h2 className="text-center text-3xl sm:text-4xl">Why readers choose this series</h2>
          <ul className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
            {SERIES.benefits.map((b) => (
              <li key={b} className="flex gap-3 rounded-xl border border-line bg-white p-5">
                <IconCheck className="shrink-0 text-gold" /> {b}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <h2 className="text-center text-3xl sm:text-4xl">How to get your copy</h2>
        <div className="mx-auto mt-10 max-w-5xl">
          <HowToBuy />
        </div>
      </section>
    </>
  );
}
