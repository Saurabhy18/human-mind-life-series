import type { Metadata } from "next";
import { CONFIG, SITE_URL, isPlaceholder } from "@/config/site.config";
import type { FaqItem } from "@/content/books";
import type { Book } from "./products";

type PageMeta = {
  title: string;
  description: string;
  path: string;
  /** Hide from search engines (checkout, thank-you, ad landing pages, admin). */
  noIndex?: boolean;
  /** Use the full title as-is instead of appending the site name. */
  absoluteTitle?: boolean;
  /** Social sharing image (defaults to the site-wide image). */
  image?: string;
};

/** Builds consistent title, description, canonical URL, Open Graph and Twitter tags. */
export function pageMetadata({ title, description, path, noIndex, absoluteTitle, image }: PageMeta): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${CONFIG.SITE_NAME}`;
  const ogImage = image ?? "/opengraph-image";
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: CONFIG.SITE_NAME,
      type: "website",
      locale: "en_IN",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [ogImage] },
    robots: noIndex ? { index: false, follow: true } : undefined,
  };
}

export function bookOgImage(book: Pick<Book, "slug">): string {
  return `/og/books/${book.slug}`;
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function authorSchema(book: Pick<Book, "author">) {
  return { "@type": "Person", name: book.author };
}

export function organizationSchema() {
  const sameAs = [CONFIG.INSTAGRAM_URL, CONFIG.FACEBOOK_URL, CONFIG.YOUTUBE_URL].filter((u) => !isPlaceholder(u));
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: CONFIG.SITE_NAME,
    url: SITE_URL,
    ...(isPlaceholder(CONFIG.AUTHOR_EMAIL) ? {} : { email: CONFIG.AUTHOR_EMAIL }),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function bookSchema(book: Book) {
  const url = absoluteUrl(`/books/${book.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": ["Book", "Product"],
    "@id": `${url}#book`,
    name: book.title,
    description: book.shortDescription,
    url,
    image: book.cover ? [absoluteUrl(book.cover), absoluteUrl(bookOgImage(book))] : absoluteUrl(bookOgImage(book)),
    author: authorSchema(book),
    brand: { "@type": "Brand", name: CONFIG.SITE_NAME },
    bookFormat: "https://schema.org/EBook",
    inLanguage: "en",
    position: book.volume,
    isPartOf: { "@type": "BookSeries", name: CONFIG.SITE_NAME, url: absoluteUrl("/books") },
    ...(book.adultsOnly ? { audience: { "@type": "PeopleAudience", suggestedMinAge: 18 } } : {}),
    offers: {
      "@type": "Offer",
      url,
      price: book.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}

export function seriesSchema(books: Book[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BookSeries",
    name: CONFIG.SITE_NAME,
    url: absoluteUrl("/books"),
    author: books.map(authorSchema),
    hasPart: books.map((b) => ({ "@type": "Book", name: b.title, author: authorSchema(b), url: absoluteUrl(`/books/${b.slug}`), position: b.volume })),
  };
}

export function faqSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items
      .filter((i) => !i.a.startsWith("["))
      .map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}
