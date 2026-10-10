import Link from "next/link";
import type { Metadata } from "next";
import { CONFIG, SITE_URL } from "@/config/site.config";
import { SERIES } from "@/content/books";
import { getGeneralFaqs } from "@/content/faqs";
import { ALL_BOOKS, BUNDLE_SLUG, FREE_BOOKS, PAID_BOOKS, bookActionHref, bundleEnabled, formatINR, formatPrice, individualTotal, volumeRange } from "@/lib/products";
import { countWord } from "@/lib/text";
import { faqSchema, organizationSchema, pageMetadata, seriesSchema } from "@/lib/seo";
import { BookCard } from "@/components/BookCard";
import { BookCover } from "@/components/BookCover";
import { FaqList } from "@/components/FaqList";
import { JsonLd } from "@/components/JsonLd";
import { AuthorsGrid } from "@/components/AuthorBlock";
import { SectionHeading } from "@/components/PageHeader";
import { IconArrowRight, IconBook, IconCheck, IconPhone, IconQr, IconShield } from "@/components/icons";

export const metadata: Metadata = pageMetadata({
  title: `${CONFIG.SITE_NAME} — Psychology, Human Behaviour & Personal Growth Books`,
  description:
    "Explore the human mind. Understand life. Understand yourself. A six-volume series of psychology and personal growth books about human behaviour and human nature — start with The Intimacy Code, free.",
  path: "/",
  absoluteTitle: true,
});

export default function HomePage() {
  const faqs = getGeneralFaqs().slice(0, 6);
  const [v1, v2, v3, v4, v5] = ALL_BOOKS;
  const freeBook = FREE_BOOKS[0];
  const stats = [
    { n: ALL_BOOKS.length, label: "Volumes" },
    { n: PAID_BOOKS.length, label: PAID_BOOKS.length === 1 ? "Paid Book" : "Paid Books" },
    ...(FREE_BOOKS.length ? [{ n: FREE_BOOKS.length, label: FREE_BOOKS.length === 1 ? "Free Book" : "Free Books" }] : []),
  ];

  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          { "@context": "https://schema.org", "@type": "WebSite", name: CONFIG.SITE_NAME, url: SITE_URL },
          seriesSchema(ALL_BOOKS),
          faqSchema(faqs),
        ]}
      />

      {/* ------------------------------------------------------------ Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_20%,rgba(179,139,69,0.14),transparent_70%)]" />
        <div className="container-page relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div>
            <p className="eyebrow animate-fade-up">{CONFIG.SITE_NAME} · {countWord(ALL_BOOKS.length)} Volumes</p>
            <h1 className="mt-5 animate-fade-up text-[2.6rem] leading-[1.05] font-medium sm:text-6xl lg:text-[4.1rem]">
              Explore the Human Mind. <span className="text-gold-dark italic">Understand Life.</span> Understand Yourself.
            </h1>
            <p className="mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-muted [animation-delay:120ms]">{SERIES.shortDescription}</p>
            <div className="mt-9 flex animate-fade-up flex-col gap-3 [animation-delay:200ms] sm:flex-row">
              <Link href="/books" className="btn-primary px-8 py-4 text-base">
                Explore the Books <IconArrowRight />
              </Link>
              <Link href={`/books/${v1.slug}`} className="btn-outline px-8 py-4 text-base">
                Start with Volume 1
              </Link>
            </div>
            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4 [animation-delay:260ms]">
              {stats.map((s) => (
                <div key={s.label} className="flex items-baseline gap-2">
                  <dt className="sr-only">{s.label}</dt>
                  <dd className={`font-serif text-3xl ${s.label.startsWith("Free") ? "text-success" : "text-ink"}`}>{s.n}</dd>
                  <span className="text-sm font-medium text-muted" aria-hidden="true">{s.label}</span>
                </div>
              ))}
            </dl>
          </div>

          {/* Fanned stack of covers */}
          <div className="relative mx-auto h-[340px] w-full max-w-[460px] animate-fade-up [animation-delay:150ms] sm:h-[440px]" aria-hidden="true">
            {[v4, v2, v5, v3, v1].map((b, i) => {
              const pos = [
                "left-[2%] top-[14%] w-[30%] -rotate-[10deg]",
                "left-[14%] top-[8%] w-[34%] -rotate-[5deg]",
                "right-[2%] top-[14%] w-[30%] rotate-[10deg]",
                "right-[14%] top-[8%] w-[34%] rotate-[5deg]",
                "left-1/2 top-0 w-[40%] -translate-x-1/2",
              ][i];
              return (
                <div key={b.slug} className={`absolute ${pos}`}>
                  <BookCover book={b} size="sm" priority={i === 4} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Trust strip */}
      <section className="border-y border-line bg-white">
        <ul className="container-page grid grid-cols-2 gap-6 py-7 text-sm md:grid-cols-4">
          {[
            { Icon: IconBook, text: `${countWord(ALL_BOOKS.length)} volumes, one series` },
            { Icon: IconPhone, text: `${CONFIG.BOOK_FORMAT} for any device` },
            { Icon: IconQr, text: "Simple UPI QR payment" },
            { Icon: IconShield, text: "Personally verified delivery" },
          ].map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-ink/80">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-gold-dark">
                <Icon />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </section>

      {/* --------------------------------------------------- Start for free */}
      {freeBook && (
        <section className="container-page pt-16 sm:pt-20" aria-labelledby="start-free">
          <div className="relative overflow-hidden rounded-3xl border border-success/30 bg-gradient-to-br from-white via-white to-success/[0.08] p-6 sm:p-10">
            <div className="grid items-center gap-8 md:grid-cols-[200px_1fr] md:gap-12">
              <Link href={`/books/${freeBook.slug}`} className="mx-auto w-40 md:w-full" aria-label={`View ${freeBook.title}`}>
                <BookCover book={freeBook} size="sm" />
              </Link>
              <div>
                <p className="text-xs font-bold tracking-[0.22em] text-success uppercase">Start for Free</p>
                <h2 id="start-free" className="mt-3 text-3xl leading-tight sm:text-4xl">
                  {freeBook.label}
                </h2>
                <p className="mt-2 text-sm text-muted">by {freeBook.author}{freeBook.adultsOnly ? " · For adult readers (18+)" : ""}</p>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink/80">Get your free copy and explore the series.</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link href={bookActionHref(freeBook)} className="btn-free px-8 py-4 text-base">
                    GET FREE BOOK <IconArrowRight />
                  </Link>
                  <span className="free-badge self-start sm:self-auto">Free Book</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------- Featured books */}
      <section className="container-page py-20 sm:py-24" id="books">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading eyebrow="Featured Books" title="Choose your next read" intro="Each volume explores a different side of the human mind and life." />
          <Link href="/books" className="inline-flex items-center gap-2 text-sm font-semibold text-gold-dark hover:text-ink">
            View all books <IconArrowRight width={16} />
          </Link>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_BOOKS.slice(0, 3).map((b) => (
            <BookCard key={b.slug} book={b} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ Series overview */}
      <section className="bg-cream/70 py-20 sm:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading eyebrow={`The ${countWord(ALL_BOOKS.length)}-Volume Series`} title="One journey through the human mind and life" />
            <div className="mt-5 space-y-4 text-lg leading-relaxed text-muted">
              {SERIES.longDescription.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
          <ol className="space-y-4">
            {ALL_BOOKS.map((b) => (
              <li key={b.slug}>
                <Link href={`/books/${b.slug}`} className="card lift group flex items-center gap-5 p-4 sm:gap-6 sm:p-5">
                  <div className="w-16 shrink-0 sm:w-20">
                    <BookCover book={b} size="xs" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow">
                      {b.volumeLabel}
                      {b.free && <span className="free-badge ml-2 px-2 py-0.5 text-[0.6rem]">Free</span>}
                    </p>
                    <h3 className="mt-1 text-lg leading-snug sm:text-xl">{b.title}</h3>
                    <p className="text-xs text-muted">by {b.author}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{b.tagline}</p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className={`font-serif text-xl ${b.free ? "font-semibold text-success" : ""}`}>{formatPrice(b)}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-gold-dark group-hover:text-ink">
                      View <IconArrowRight width={14} />
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------ Explore all volumes */}
      <section className="container-page pt-20 sm:pt-24" aria-labelledby="explore-all">
        <div className="rounded-3xl bg-ink px-6 py-12 text-white sm:px-12">
          <div className="text-center">
            <p className="eyebrow text-gold-light">The Complete Series</p>
            <h2 id="explore-all" className="mt-3 text-3xl text-white sm:text-4xl">Explore All {ALL_BOOKS.length} Volumes</h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-xs font-semibold tracking-[0.18em] text-gold-light uppercase">Paid Volumes · {volumeRange(PAID_BOOKS)}</p>
              <ul className="mt-4 space-y-2 text-sm text-white/80">
                {PAID_BOOKS.map((b) => (
                  <li key={b.slug}>
                    <Link href={`/books/${b.slug}`} className="hover:text-white">
                      <span className="text-gold-light">{b.volume}.</span> {b.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {freeBook && (
              <div className="rounded-2xl border border-success/50 bg-success/15 p-6">
                <p className="text-xs font-semibold tracking-[0.18em] text-emerald-200 uppercase">Free Book</p>
                <p className="mt-4 font-serif text-2xl text-white">{freeBook.title}</p>
                <p className="mt-1 text-sm text-white/70">by {freeBook.author}</p>
                <Link href={bookActionHref(freeBook)} className="btn-free mt-6">
                  GET FREE BOOK
                </Link>
              </div>
            )}
          </div>
          {freeBook && (
            <p className="mx-auto mt-10 max-w-2xl text-center text-lg text-white/80">
              Start with {freeBook.title} for FREE, then explore the complete series.
            </p>
          )}
          <div className="mt-6 text-center">
            <Link href="/books" className="btn-gold px-8 py-4 text-base">
              Explore the Books <IconArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {bundleEnabled() && (
        <section className="container-page pt-20">
          <div className="card flex flex-col items-start justify-between gap-6 border-gold/40 bg-gradient-to-r from-white to-cream p-8 sm:flex-row sm:items-center sm:p-10">
            <div>
              <p className="eyebrow">Complete-Series Offer</p>
              <h2 className="mt-2 text-3xl">All {PAID_BOOKS.length} paid volumes for {formatINR(CONFIG.SERIES_BUNDLE.price)}</h2>
              <p className="mt-2 text-muted">
                Bought individually: <span className="line-through">{formatINR(individualTotal())}</span>
              </p>
            </div>
            <Link href={`/checkout/${BUNDLE_SLUG}`} className="btn-gold px-8 py-4 text-base">
              Buy the Complete Series
            </Link>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- Why read */}
      <section className="container-page py-20 sm:py-24">
        <SectionHeading center eyebrow="Why Read This Series?" title="Understanding people begins with understanding the mind" />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERIES.whyRead.map((item, i) => (
            <div key={item.title} className="card p-7">
              <p className="font-serif text-3xl text-gold">0{i + 1}</p>
              <h3 className="mt-4 text-xl">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------- Reader benefits */}
      <section className="bg-ink py-20 text-white sm:py-24">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-gold-light">Reader Benefits</p>
            <h2 className="mt-3 text-3xl leading-tight text-white sm:text-4xl">What you get with every book</h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-white/70">
              A straightforward buying experience and a book you can read wherever you are.
            </p>
            <Link href="/books" className="btn-gold mt-8 px-8 py-4 text-base">
              Browse the Books <IconArrowRight />
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {SERIES.benefits.map((b) => (
              <li key={b} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <IconCheck className="mt-0.5 shrink-0 text-gold" />
                <span className="text-white/85">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ Author */}
      <section className="container-page py-20 sm:py-24">
        <AuthorsGrid />
      </section>

      {/* --------------------------------------------------------------- FAQ */}
      <section className="bg-cream/70 py-20 sm:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading eyebrow="FAQ" title="Questions, answered" intro="Everything you need to know about buying and receiving your books." />
            <Link href="/faq" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-dark hover:text-ink">
              See all questions <IconArrowRight width={16} />
            </Link>
          </div>
          <FaqList items={faqs} />
        </div>
      </section>

      {/* --------------------------------------------------------------- CTA */}
      <section className="container-page py-20 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-16 text-center sm:px-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_0%,rgba(179,139,69,0.28),transparent_70%)]" />
          <div className="relative">
            <p className="eyebrow text-gold-light">Begin Today</p>
            <h2 className="mx-auto mt-3 max-w-2xl text-3xl leading-tight text-white sm:text-5xl">Start your journey into the human mind</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">Choose a volume, pay securely by UPI, and receive your book once your payment is verified.</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/books" className="btn-gold px-8 py-4 text-base">
                Explore the Books
              </Link>
              <Link href={`/books/${v1.slug}`} className="btn-light px-8 py-4 text-base">
                Start with Volume 1
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
