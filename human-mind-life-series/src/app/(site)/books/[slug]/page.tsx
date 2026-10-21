import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONFIG } from "@/config/site.config";
import { PACKAGES } from "@/config/packages";
import { bundleEnabled, formatINR, packageCheckoutHref } from "@/lib/products";
import { bookOgImage, bookSchema, breadcrumbSchema, faqSchema, pageMetadata } from "@/lib/seo";
import { BookCover } from "@/components/BookCover";
import { BookPrice } from "@/components/BookPrice";
import { OfferCountdown } from "@/components/OfferCountdown";
import { FaqList } from "@/components/FaqList";
import { JsonLd } from "@/components/JsonLd";
import { TrackView } from "@/components/tracking/TrackView";
import { StickyBuyBar } from "@/components/book/StickyBuyBar";
import { bookFaqs, Disclaimer, LearnList, SamplePreview, TableOfContents, TopicList } from "@/components/book/BookSections";
import { IconArrowRight, IconCheck } from "@/components/icons";
import { FreeBadge, FreeBookSection } from "@/components/free/FreeBookSection";
import { BookPurchase } from "@/components/translation/BookPurchase";
import { paymentCopy } from "@/content/paymentCopy";
import { checkoutMode } from "@/lib/server/paymentService";
import { translationOffered } from "@/config/env.server";
import { bookIsTranslatable } from "@/lib/server/orderLanguage";

import { getBookFromDbOrStatic, getSiteCatalog } from "@/lib/server/books";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = true;
export const revalidate = 60;

export function generateStaticParams() {
  const { allBooks } = getSiteCatalog();
  return allBooks.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const book = getBookFromDbOrStatic(slug);
  if (!book) return {};
  return pageMetadata({ title: book.seo.title, description: book.seo.description, path: `/books/${book.slug}`, image: bookOgImage(book) });
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params;
  const book = getBookFromDbOrStatic(slug);
  if (!book) notFound();

  const { allBooks } = getSiteCatalog();
  const mode = checkoutMode();
  const pay = paymentCopy(mode);
  const faqs = bookFaqs(book, mode);
  const others = allBooks.filter((b) => b.slug !== book.slug);
  const tracked = { slug: book.slug, label: book.label, price: book.price };

  return (
    <>
      <JsonLd
        data={[
          bookSchema(book),
          faqSchema(faqs),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Books", path: "/books" },
            { name: book.title, path: `/books/${book.slug}` },
          ]),
        ]}
      />
      <TrackView event="view_item" product={tracked} />

      <div className="container-page pt-6 pb-28 md:pb-20">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="hover:text-ink">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/books" className="hover:text-ink">Books</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-ink">{book.volumeLabel ?? book.title}</li>
          </ol>
        </nav>

        <div className="mt-8 grid gap-12 lg:grid-cols-[420px_1fr] lg:gap-16">
          {/* Cover */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-3xl bg-cream px-10 py-12 sm:px-16">
              <div className="mx-auto max-w-[300px] animate-fade-up">
                <BookCover book={book} size="lg" priority />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-14">
            <header>
              <p className="eyebrow">{CONFIG.SITE_NAME}{book.volumeLabel && ` · ${book.volumeLabel}`}</p>
              <h1 className="mt-3 text-4xl leading-[1.1] sm:text-5xl">{book.title}</h1>
              <p className="mt-3 text-lg text-muted">
                by <span className="font-medium text-ink">{book.author}</span>
              </p>
              <p className="mt-6 font-serif text-xl leading-relaxed text-ink/85 italic">{book.tagline}</p>

              {book.free ? (
                <div className="mt-8 rounded-2xl border border-success/30 bg-white p-6 ring-1 ring-success/10">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <FreeBadge />
                      <p className="mt-3 font-serif text-4xl font-semibold tracking-wide text-success">FREE</p>
                      <p className="mt-1 text-lg text-ink">Get {book.title} at no cost.</p>
                    </div>
                    <p className="text-sm text-muted">{CONFIG.BOOK_FORMAT} · No payment needed</p>
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <a href="#get-free" className="btn-free flex-1 py-4 text-base">
                      GET FREE BOOK <IconArrowRight />
                    </a>
                    <Link href="/books" className="btn-outline py-4">
                      View all volumes
                    </Link>
                  </div>
                  <ul className="mt-6 grid gap-2 text-sm text-muted sm:grid-cols-2">
                    <li className="flex items-center gap-2"><IconCheck width={16} className="text-success" /> No payment or QR code</li>
                    <li className="flex items-center gap-2"><IconCheck width={16} className="text-success" /> Just your name &amp; email</li>
                    <li className="flex items-center gap-2"><IconCheck width={16} className="text-success" /> Read on any device</li>
                    <li className="flex items-center gap-2"><IconCheck width={16} className="text-success" /> Support by email &amp; WhatsApp</li>
                  </ul>
                  {book.adultsOnly && (
                    <p className="mt-5 rounded-lg bg-cream px-4 py-3 text-sm font-medium text-ink/80">This book is intended for adult readers (18+).</p>
                  )}
                </div>
              ) : (
              <div className="mt-8 rounded-2xl border border-line bg-white p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted">Price</p>
                    <p className="font-serif text-4xl"><BookPrice book={book} size="lg" /></p>
                  </div>
                  <p className="text-sm text-muted">{CONFIG.BOOK_FORMAT} · Delivered by email / WhatsApp</p>
                </div>
                <OfferCountdown className="mt-5" />
                <div className="mt-6">
                  <BookPurchase slug={book.slug} translations={bookIsTranslatable(book.slug)} />
                  <Link href="/books" className="mt-3 inline-block text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
                    View all volumes
                  </Link>
                </div>
                {bundleEnabled() && (
                  <p className="mt-5 rounded-lg bg-cream px-4 py-3 text-sm text-ink/80">
                    Save with a bundle:{" "}
                    <Link href={packageCheckoutHref("three_book_bundle", book.slug)} className="font-semibold underline underline-offset-2 hover:text-gold-dark">
                      any {PACKAGES.three_book_bundle.books} books for {formatINR(PACKAGES.three_book_bundle.price)}
                    </Link>{" "}
                    or{" "}
                    <Link href={packageCheckoutHref("five_book_bundle")} className="font-semibold underline underline-offset-2 hover:text-gold-dark">
                      all {PACKAGES.five_book_bundle.books} for {formatINR(PACKAGES.five_book_bundle.price)}
                    </Link>
                    {translationOffered() ? ", each in the language you choose." : "."}
                  </p>
                )}
                <ul className="mt-6 grid gap-2 text-sm text-muted sm:grid-cols-2">
                  <li className="flex items-center gap-2"><IconCheck width={16} className="text-gold" /> {pay.bulletPay}</li>
                  <li className="flex items-center gap-2"><IconCheck width={16} className="text-gold" /> {pay.bulletConfirmed}</li>
                  <li className="flex items-center gap-2"><IconCheck width={16} className="text-gold" /> Read on any device</li>
                  <li className="flex items-center gap-2"><IconCheck width={16} className="text-gold" /> Support by email &amp; WhatsApp</li>
                </ul>
                {book.adultsOnly && (
                  <p className="mt-5 rounded-lg bg-cream px-4 py-3 text-sm font-medium text-ink/80">This book is intended for adult readers (18+).</p>
                )}
              </div>
              )}
            </header>

            <section aria-labelledby="about-book">
              <h2 id="about-book" className="text-2xl sm:text-3xl">About this book</h2>
              <div className="mt-5 space-y-4 text-lg leading-relaxed text-ink/80">
                {book.description.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
            </section>

            <LearnList book={book} />
            <TopicList book={book} />
            <TableOfContents book={book} />
            <SamplePreview book={book} />

            {book.free ? (
              <FreeBookSection book={book} />
            ) : (
              <section aria-labelledby="buy-cta" className="rounded-3xl bg-ink p-8 text-white sm:p-10">
                <h2 id="buy-cta" className="text-2xl text-white sm:text-3xl">Get {book.volumeLabel ?? book.title} today</h2>
                <OfferCountdown tone="dark" className="mt-5" />
                <p className="mt-5 text-white/70">
                  {book.title} — <BookPrice book={book} tone="dark" size="sm" priceClassName="font-semibold text-white" />. {pay.bookCta}
                </p>
                <Link href={`/checkout/${book.slug}`} className="btn-gold mt-6 px-8 py-4 text-base">
                  Buy Now <IconArrowRight />
                </Link>
              </section>
            )}

            <section aria-labelledby="book-faq">
              <h2 id="book-faq" className="mb-6 text-2xl sm:text-3xl">Frequently asked questions</h2>
              <FaqList items={faqs} />
            </section>

            <Disclaimer book={book} />
          </div>
        </div>

        <section aria-labelledby="more" className="mt-24">
          <h2 id="more" className="text-2xl sm:text-3xl">More from the series</h2>
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {others.map((b) => (
              <Link key={b.slug} href={`/books/${b.slug}`} className="group">
                <div className="lift rounded-xl bg-cream p-6">
                  <BookCover book={b} size="sm" />
                </div>
                <p className="eyebrow mt-4">{b.volumeLabel ?? "Free Book"}</p>
                <p className="mt-1 font-serif text-lg leading-snug group-hover:text-gold-dark">{b.title}</p>
                <p className={`mt-1 text-sm ${b.free ? "font-semibold text-success" : "text-muted"}`}><BookPrice book={b} size="sm" priceClassName={b.free ? "" : "font-semibold text-ink"} /></p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <StickyBuyBar book={book} />
    </>
  );
}
