import { ALL_BOOKS, formatPrice } from "@/lib/products";
import { getBookFromDbOrStatic } from "@/lib/server/books";
import { discountPercent } from "@/config/packages";
import { renderOgImage } from "@/lib/og";

/** Social-sharing image for each book: /og/books/<slug> (1200×630 PNG). */
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return ALL_BOOKS.map((b) => ({ slug: b.slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const book = getBookFromDbOrStatic((await params).slug);
  if (!book) return new Response("Not found", { status: 404 });
  return renderOgImage({
    eyebrow: book.free ? "FREE BOOK" : `${book.volumeLabel ?? book.title} · ${formatPrice(book)}${book.originalPrice ? ` (${discountPercent(book.price, book.originalPrice)}% OFF)` : ""}`,
    title: book.title,
    subtitle: book.tagline,
    byline: `by ${book.author}`,
    bg: book.coverTheme.bg,
    accent: book.coverTheme.accent,
  });
}
