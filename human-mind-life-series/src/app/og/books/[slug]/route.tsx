import { ALL_BOOKS, formatPrice, getBook } from "@/lib/products";
import { renderOgImage } from "@/lib/og";

/** Social-sharing image for each book: /og/books/<slug> (1200×630 PNG). */
export const dynamic = "force-static";

export function generateStaticParams() {
  return ALL_BOOKS.map((b) => ({ slug: b.slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const book = getBook((await params).slug);
  if (!book) return new Response("Not found", { status: 404 });
  return renderOgImage({
    eyebrow: book.free ? "FREE BOOK" : `${book.volumeLabel ?? book.title} · ${formatPrice(book)}`,
    title: book.title,
    subtitle: book.tagline,
    byline: `by ${book.author}`,
    bg: book.coverTheme.bg,
    accent: book.coverTheme.accent,
  });
}
