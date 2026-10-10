import Link from "next/link";
import type { Metadata } from "next";
import { CONFIG } from "@/config/site.config";
import { PACKAGES } from "@/config/packages";
import { ALL_BOOKS, BUNDLE_SLUG, FREE_BOOKS, PAID_BOOKS, bookActionHref, bundleEnabled, bundlePrice, formatINR, individualTotal, packageCheckoutHref, volumeRange } from "@/lib/products";
import { breadcrumbSchema, pageMetadata, seriesSchema } from "@/lib/seo";
import { BookCard } from "@/components/BookCard";
import { JsonLd } from "@/components/JsonLd";
import { PageHeader } from "@/components/PageHeader";
import { OfferCountdown } from "@/components/OfferCountdown";
import { IconQr, IconShield, IconMail } from "@/components/icons";
import { paymentCopy } from "@/content/paymentCopy";
import { checkoutMode } from "@/lib/server/paymentService";
import { translationOffered } from "@/config/env.server";

export const metadata: Metadata = pageMetadata({
  title: "All Books — Psychology & Self Improvement Books",
  description:
    "Browse all six volumes of The Human Mind & Life Series: psychology, human behaviour and personal growth books as PDF eBooks. The Intimacy Code is free.",
  path: "/books",
});

export default function BooksPage() {
  const pay = paymentCopy(checkoutMode());
  return (
    <>
      <JsonLd data={[seriesSchema(ALL_BOOKS), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Books", path: "/books" }])]} />
      <PageHeader
        eyebrow="The Books"
        title="The Human Mind & Life Series"
        intro="Six volumes about human behaviour, human nature, relationships and the art of living well. Choose a book to read more, buy it now, or start with the free volume."
      />

      {FREE_BOOKS.map((fb) => (
        <div key={fb.slug} className="container-page pt-10">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-success/30 bg-success/[0.06] px-6 py-5 sm:flex-row sm:items-center">
            <p className="text-ink/85">
              <span className="free-badge mr-3">Free Book</span>
              <strong>{fb.title}</strong> by {fb.author} is completely free.
            </p>
            <Link href={bookActionHref(fb)} className="btn-free shrink-0">
              GET FREE BOOK
            </Link>
          </div>
        </div>
      ))}

      <section className="container-page py-16 sm:py-20">
        <OfferCountdown variant="banner" scope={volumeRange(PAID_BOOKS)} className="mb-8" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_BOOKS.map((b) => (
            <BookCard key={b.slug} book={b} headingLevel="h2" />
          ))}

          {bundleEnabled() && (
            <article className="card flex flex-col justify-between border-gold/50 bg-gradient-to-b from-cream to-white p-8">
              <div>
                <p className="eyebrow">Complete-Series Offer</p>
                <h2 className="mt-3 text-2xl">All {PAID_BOOKS.length} Paid Volumes</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Get every book in The Human Mind &amp; Life Series in a single purchase{translationOffered() ? " — each in the language you choose" : ""}.
                </p>
              </div>
              <div>
                <p className="mt-8 font-serif text-4xl">{formatINR(bundlePrice())}</p>
                <p className="mt-1 text-sm text-muted">
                  Individually: <span className="line-through">{formatINR(individualTotal())}</span>
                </p>
                <Link href={`/checkout/${BUNDLE_SLUG}`} className="btn-gold mt-6 w-full">
                  Buy Now
                </Link>
                <Link href={packageCheckoutHref("three_book_bundle")} className="btn-outline mt-3 w-full">
                  Any {PACKAGES.three_book_bundle.books} books — {formatINR(PACKAGES.three_book_bundle.price)}
                </Link>
              </div>
            </article>
          )}
        </div>

        <ul className="mt-16 grid gap-6 rounded-2xl border border-line bg-white p-6 sm:grid-cols-3 sm:p-8">
          <li className="flex gap-4">
            <IconQr className="mt-1 shrink-0 text-gold-dark" />
            <div>
              <h3 className="font-sans text-sm font-semibold">{pay.payShort}</h3>
              <p className="mt-1 text-sm text-muted">{pay.payDetail}</p>
            </div>
          </li>
          <li className="flex gap-4">
            <IconShield className="mt-1 shrink-0 text-gold-dark" />
            <div>
              <h3 className="font-sans text-sm font-semibold">{pay.confirmedShort}</h3>
              <p className="mt-1 text-sm text-muted">{pay.confirmedDetail}</p>
            </div>
          </li>
          <li className="flex gap-4">
            <IconMail className="mt-1 shrink-0 text-gold-dark" />
            <div>
              <h3 className="font-sans text-sm font-semibold">Delivered to you</h3>
              <p className="mt-1 text-sm text-muted">Your {CONFIG.BOOK_FORMAT} is sent to your email or WhatsApp.</p>
            </div>
          </li>
        </ul>
      </section>
    </>
  );
}
