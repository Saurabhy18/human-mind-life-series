import { NextResponse } from "next/server";
import { getBookFromDbOrStatic } from "@/lib/server/books";
import { bookIsTranslatable } from "@/lib/server/orderLanguage";

export const runtime = "nodejs";

/**
 * GET /api/books/:bookId — public book information.
 * The source file location is deliberately NOT included: book files are private.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const book = getBookFromDbOrStatic((await params).bookId);
  if (!book) return NextResponse.json({ success: false, message: "Book not found." }, { status: 404 });
  return NextResponse.json(
    {
      success: true,
      book: {
        id: book.slug,
        title: book.title,
        author: book.author,
        volume: book.volumeLabel,
        sourceLanguage: book.sourceLanguage,
        price: book.price,
        currency: book.currency,
        free: book.free,
        active: true,
        multilingual: !book.free && bookIsTranslatable(book.slug),
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      },
    }
  );
}
