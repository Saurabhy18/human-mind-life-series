import { NextResponse } from "next/server";
import { verifyAdminApi } from "@/lib/server/auth";
import { listDbBooks } from "@/lib/server/books";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/books
 * Returns paginated books for the admin dashboard.
 * Requires admin authentication and enforces 15 records per page by default.
 */
export async function GET(req: Request) {
  const authError = await verifyAdminApi();
  if (authError) return authError;

  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") || "all";
  const q = (url.searchParams.get("q") || "").toLowerCase().trim();

  const rawPage = parseInt(url.searchParams.get("page") || "1", 10);
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);

  const rawPageSize = parseInt(url.searchParams.get("pageSize") || url.searchParams.get("limit") || "15", 10);
  const pageSize = Math.min(Math.max(1, isNaN(rawPageSize) ? 15 : rawPageSize), 100);

  const allBooks = listDbBooks();
  let books = allBooks;

  if (filter === "sale") {
    books = books.filter((b) => b.for_sale);
  } else if (filter === "free") {
    books = books.filter((b) => b.is_free);
  }

  if (q) {
    books = books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q)
    );
  }

  const totalFiltered = books.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const offset = (page - 1) * pageSize;
  const pagedBooks = books.slice(offset, offset + pageSize);

  return NextResponse.json({
    success: true,
    books: pagedBooks,
    pagination: {
      page,
      pageSize,
      total: totalFiltered,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    counts: {
      all: allBooks.length,
      sale: allBooks.filter((b) => b.for_sale).length,
      free: allBooks.filter((b) => b.is_free).length,
    },
  });
}
