import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { listDbBooks } from "@/lib/server/books";
import { deleteBookAction, toggleBookStatusAction } from "@/app/admin/books/actions";

export const dynamic = "force-dynamic";

export default async function AdminBooksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = sp.filter || "all";
  const q = (sp.q || "").toLowerCase().trim();

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

  const allCount = allBooks.length;
  const saleCount = allBooks.filter((b) => b.for_sale).length;
  const freeCount = allBooks.filter((b) => b.is_free).length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-gold-dark uppercase">
            Catalogue Management
          </p>
          <h1 className="mt-1 font-serif text-3xl font-medium text-ink">
            Books &amp; Catalogue
          </h1>
          <p className="mt-1 text-sm text-muted">
            Add, configure and manage books for sale or free download. PDFs are stored securely in Supabase Storage.
          </p>
        </div>
        <Link href="/admin/books/new" className="btn-primary px-5 py-2.5 text-sm font-semibold shadow-sm">
          + Add New Book
        </Link>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/admin/books"
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            filter === "all"
              ? "bg-ink text-white"
              : "border border-line bg-white text-ink/75 hover:border-ink/30"
          }`}
        >
          All Books <span className={filter === "all" ? "text-white/70" : "text-muted"}>({allCount})</span>
        </Link>
        <Link
          href="/admin/books?filter=sale"
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            filter === "sale"
              ? "bg-ink text-white"
              : "border border-line bg-white text-ink/75 hover:border-ink/30"
          }`}
        >
          For Sale <span className={filter === "sale" ? "text-white/70" : "text-muted"}>({saleCount})</span>
        </Link>
        <Link
          href="/admin/books?filter=free"
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            filter === "free"
              ? "bg-ink text-white"
              : "border border-line bg-white text-ink/75 hover:border-ink/30"
          }`}
        >
          Free Downloads <span className={filter === "free" ? "text-white/70" : "text-muted"}>({freeCount})</span>
        </Link>
      </div>

      {/* Search */}
      <form className="mt-4 flex max-w-md gap-2" action="/admin/books">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title, author or slug..."
          className="input py-2"
        />
        <button type="submit" className="btn-primary px-4 py-2 text-sm">
          Search
        </button>
      </form>

      {/* Books Table */}
      {books.length === 0 ? (
        <div className="card mt-8 p-12 text-center text-muted">
          No books found matching your criteria.
        </div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-paper text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Book</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3">Pricing</th>
                <th className="px-4 py-3">Distribution Channels</th>
                <th className="px-4 py-3">Storage PDF</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {books.map((b) => (
                <tr key={b.id} className="align-middle hover:bg-paper/50 transition-colors">
                  {/* Book Title & Vol */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-8 rounded shrink-0 shadow-xs"
                        style={{ backgroundColor: b.cover_bg || "#13233f" }}
                        title={`Theme: ${b.cover_bg}`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{b.title}</span>
                          {b.volume != null && !b.hide_volume_label && (
                            <span className="rounded bg-paper border border-line px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-muted">
                              Vol {b.volume}
                            </span>
                          )}
                          {b.adults_only && (
                            <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[0.65rem] font-bold text-danger">
                              18+
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs text-muted mt-0.5">/books/{b.slug}</p>
                      </div>
                    </div>
                  </td>

                  {/* Author */}
                  <td className="px-4 py-3.5 text-ink/80">{b.author}</td>

                  {/* Pricing */}
                  <td className="px-4 py-3.5">
                    {b.for_sale ? (
                      <div>
                        <span className="font-semibold text-ink">₹{b.price}</span>
                        {b.original_price != null && b.original_price > b.price && (
                          <span className="ml-1.5 text-xs text-muted line-through">
                            ₹{b.original_price}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted">Not for sale</span>
                    )}
                  </td>

                  {/* Distribution Status / Toggles */}
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* For Sale Toggle */}
                      <form action={toggleBookStatusAction}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="field" value="for_sale" />
                        <input type="hidden" name="value" value={b.for_sale ? "false" : "true"} />
                        <button
                          type="submit"
                          title="Click to toggle sale availability"
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer border transition ${
                            b.for_sale
                              ? "bg-gold/15 border-gold/40 text-gold-dark hover:bg-gold/25"
                              : "bg-paper border-line text-muted line-through hover:border-ink/40"
                          }`}
                        >
                          {b.for_sale ? "✓ For Sale" : "✕ Not For Sale"}
                        </button>
                      </form>

                      {/* Free Download Toggle */}
                      <form action={toggleBookStatusAction}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="field" value="is_free" />
                        <input type="hidden" name="value" value={b.is_free ? "false" : "true"} />
                        <button
                          type="submit"
                          title="Click to toggle free download access"
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer border transition ${
                            b.is_free
                              ? "bg-success/15 border-success/40 text-success hover:bg-success/25"
                              : "bg-paper border-line text-muted hover:border-ink/40"
                          }`}
                        >
                          {b.is_free ? "✓ Free Download" : "+ Free"}
                        </button>
                      </form>
                    </div>
                  </td>

                  {/* Storage PDF */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-ink/75 truncate max-w-[150px]">
                        {b.pdf_filename}
                      </span>
                      <a
                        href={`/api/admin/books/${b.slug}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-line bg-paper px-2 py-0.5 text-xs text-ink hover:border-gold hover:text-gold-dark transition"
                        title="Download / View PDF"
                      >
                        PDF ↗
                      </a>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/books/${b.id}`}
                        className="btn-outline px-3 py-1 text-xs font-medium hover:border-ink"
                      >
                        Edit
                      </Link>
                      <form action={deleteBookAction}>
                        <input type="hidden" name="id" value={b.id} />
                        <button
                          type="submit"
                          className="rounded border border-line px-2.5 py-1 text-xs text-muted hover:border-danger hover:text-danger transition"
                          title="Delete book"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
