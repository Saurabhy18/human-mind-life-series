import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONFIG } from "@/config/site.config";
import { ALL_BOOKS, formatINR } from "@/lib/products";
import { getBookFromDbOrStatic } from "@/lib/server/books";
import { FreeBadge, FreeBookSection } from "@/components/free/FreeBookSection";
import { BookPurchase } from "@/components/translation/BookPurchase";
import { bookOgImage, pageMetadata } from "@/lib/seo";
import { BookCover } from "@/components/BookCover";
import { BookPrice } from "@/components/BookPrice";
import { OfferCountdown } from "@/components/OfferCountdown";
import { FaqList } from "@/components/FaqList";
import { HowToBuy } from "@/components/HowToBuy";
import { TrackView } from "@/components/tracking/TrackView";
import { StickyBuyBar } from "@/components/book/StickyBuyBar";
import { bookFaqs, Disclaimer, LearnList, SamplePreview, TopicList } from "@/components/book/BookSections";
import { IconArrowRight, IconCheck, IconShield } from "@/components/icons";
import { paymentCopy } from "@/content/paymentCopy";
import { checkoutMode } from "@/lib/server/paymentService";
import { bookIsTranslatable } from "@/lib/server/orderLanguage";

/**
 * AD LANDING PAGE — one per book, e.g. /lp/the-psychology-of-human-behavior
 * Point Google / Facebook / Instagram ads here (add UTM parameters to the URL).
 * These pages are hidden from search engines so they don't compete with /books/... pages.
 */
type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = true;

export function generateStaticParams() {
  return ALL_BOOKS.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const book = getBookFromDbOrStatic((await params).slug);
  if (!book) return {};
  return pageMetadata({ title: book.seo.title, description: book.seo.description, path: `/lp/${book.slug}`, noIndex: true, image: bookOgImage(book) });
}

export default async function LandingPage({ params }: Props) {
  const book = getBookFromDbOrStatic((await params).slug);
  if (!book) notFound();
  const mode = checkoutMode();
  const pay = paymentCopy(mode);
  const tracked = { slug: book.slug, label: book.label, price: book.price };

  return (
    <>
      <TrackView event="view_item" product={tracked} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_75%_30%,rgba(179,139,69,0.25),transparent_70%)]" />
        <div className="container-page relative grid items-center gap-10 py-12 sm:py-16 md:grid-cols-[1fr_340px] lg:gap-16 lg:py-20">
          <div className="order-2 md:order-1">
            <p className="eyebrow text-gold-light">{CONFIG.SITE_NAME}{book.volumeLabel && ` · ${book.volumeLabel}`}</p>
            <h1 className="mt-4 text-4xl leading-[1.08] text-white sm:text-5xl lg:text-6xl">{book.title}</h1>
            <p className="mt-5 max-w-xl font-serif text-xl leading-relaxed text-white/80 italic">{book.tagline}</p>
            <p className="mt-4 max-w-xl leading-relaxed text-white/70">{book.shortDescription}</p>
            {book.free ? (
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                <a href="#get-free" className="btn-free px-10 py-4 text-base">
                  GET FREE BOOK <IconArrowRight />
                </a>
                <span className="flex items-center gap-3 text-sm text-white/70">
                  <FreeBadge /> Get {book.title} at no cost.
                </span>
              </div>
            ) : (
              <div className="mt-8 max-w-md">
                <p className="mb-4 font-serif text-4xl text-white">
                  <BookPrice book={book} tone="dark" size="lg" />
                </p>
                <OfferCountdown tone="dark" className="mb-5" />
                <BookPurchase slug={book.slug} translations={bookIsTranslatable(book.slug)} tone="dark" buttonClass="btn-gold px-10 py-4 text-base" label={`Buy Now — ${formatINR(book.price)}`} />
                <p className="mt-3 text-sm text-white/60">{CONFIG.BOOK_FORMAT} · {pay.payShort}</p>
              </div>
            )}
            <p className="mt-6 text-sm text-white/60">by <span className="font-medium text-white/90">{book.author}</span></p>
            {book.adultsOnly && <p className="mt-2 text-sm font-medium text-gold-light">For adult readers (18+)</p>}
          </div>
          <div className="order-1 mx-auto w-48 animate-fade-up sm:w-60 md:order-2 md:w-full">
            <BookCover book={book} size="lg" priority />
          </div>
        </div>
      </section>

      <div className="container-page space-y-20 py-16 sm:py-20">
        <section aria-labelledby="about" className="mx-auto max-w-3xl">
          <h2 id="about" className="text-2xl sm:text-3xl">About this book</h2>
          <div className="mt-5 space-y-4 text-lg leading-relaxed text-ink/80">
            {book.description.map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
          </div>
        </section>

        <div className="mx-auto max-w-4xl space-y-14">
          <LearnList book={book} />
          <TopicList book={book} />
        </div>

        {book.free ? (
          <div className="mx-auto max-w-5xl">
            <FreeBookSection book={book} />
          </div>
        ) : (
        <section aria-labelledby="how" className="mx-auto max-w-5xl">
          <h2 id="how" className="text-center text-2xl sm:text-3xl">How to get your copy</h2>
          <div className="mt-8">
            <HowToBuy />
          </div>
          <div className="mt-10 text-center">
            <Link href={`/checkout/${book.slug}`} className="btn-primary px-10 py-4 text-base">
              Buy Now — {formatINR(book.price)}
            </Link>
          </div>
        </section>
        )}

        <div className="mx-auto max-w-3xl">
          <SamplePreview book={book} />
        </div>

        <section className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          {(book.free
            ? ["Completely free, no payment", "Your details are kept private", "Support on email & WhatsApp"]
            : [pay.landingConfirmed, "We never ask for your UPI PIN or OTP", "Support on email & WhatsApp"]
          ).map((t) => (
            <div key={t} className="flex items-start gap-3 rounded-xl border border-line bg-white p-5 text-sm">
              {t.startsWith("We never") ? <IconShield className="shrink-0 text-gold-dark" /> : <IconCheck className="shrink-0 text-gold-dark" />}
              {t}
            </div>
          ))}
        </section>

        <section aria-labelledby="faq" className="mx-auto max-w-3xl">
          <h2 id="faq" className="mb-6 text-2xl sm:text-3xl">Questions</h2>
          <FaqList items={bookFaqs(book, mode)} />
        </section>

        <div className="mx-auto max-w-3xl">
          <Disclaimer book={book} />
        </div>
      </div>

      <StickyBuyBar book={book} />
    </>
  );
}
