import Link from "next/link";
import type { Metadata } from "next";
import { CONFIG } from "@/config/site.config";
import { SERIES } from "@/content/books";
import { ALL_BOOKS } from "@/lib/products";
import { countWord } from "@/lib/text";
import { authorSchema, breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { AuthorsGrid } from "@/components/AuthorBlock";
import { BookCover } from "@/components/BookCover";
import { JsonLd } from "@/components/JsonLd";
import { PageHeader, SectionHeading } from "@/components/PageHeader";

export const metadata: Metadata = pageMetadata({
  title: "About the Series & the Authors",
  description: `About ${CONFIG.SERIES_NAME}: six books on psychology, human behaviour, ancient wisdom, relationships and wellbeing by ${ALL_BOOKS.map((b) => b.author).join(", ")}.`,
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: `About ${CONFIG.SERIES_NAME}`,
            about: { "@type": "BookSeries", name: CONFIG.SERIES_NAME, author: ALL_BOOKS.map(authorSchema) },
          },
          breadcrumbSchema([{ name: "Home", path: "/" }, { name: "About", path: "/about" }]),
        ]}
      />
      <PageHeader eyebrow="About" title="About the series" intro={SERIES.shortDescription} />

      {/* ------------------------------------------------------ The series */}
      <section className="container-page grid gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <SectionHeading eyebrow="The Series" title={`${countWord(ALL_BOOKS.length)} books. One curious journey.`} />
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink/80">
            {SERIES.longDescription.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <ol className="mt-8 space-y-2">
            {ALL_BOOKS.map((b) => (
              <li key={b.slug}>
                <Link href={`/books/${b.slug}`} className="group flex flex-col gap-1 border-b border-line py-3 sm:flex-row sm:items-baseline sm:gap-4">
                  <span className="w-20 shrink-0 text-sm font-semibold text-gold-dark">{b.volumeLabel ?? "Free Book"}</span>
                  <span className="font-serif text-lg group-hover:text-gold-dark">
                    {b.title}
                    {b.free && <span className="free-badge ml-2 px-2 py-0.5 align-middle text-[0.6rem]">Free</span>}
                  </span>
                  <span className="text-sm text-muted sm:ml-auto">{b.author}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
        <div className="grid grid-cols-3 gap-4" aria-hidden="true">
          {ALL_BOOKS.slice(0, 3).map((b, i) => (
            <div key={b.slug} className={i === 1 ? "-mt-8" : "mt-8"}>
              <BookCover book={b} size="sm" />
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- Authors */}
      <section className="bg-cream/70 py-20">
        <div className="container-page">
          <AuthorsGrid showLink={false} />
        </div>
      </section>

      {/* --------------------------------------------------------- Mission */}
      <section className="container-page py-20">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2">
          <div>
            <p className="eyebrow">Our Mission</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">The mission behind the books</h2>
            <p className="mt-6 text-lg leading-relaxed whitespace-pre-line text-ink/80">{SERIES.mission}</p>
          </div>
          <div>
            <p className="eyebrow">Why This Series</p>
            <h2 className="mt-3 text-3xl sm:text-4xl">Why the series was created</h2>
            <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink/80">
              {SERIES.whyCreated.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERIES.whyRead.map((w) => (
            <div key={w.title} className="card p-6">
              <h3 className="text-lg">{w.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{w.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 text-center">
          <Link href="/books" className="btn-primary px-8 py-4 text-base">
            Explore the Books
          </Link>
        </div>
      </section>
    </>
  );
}
