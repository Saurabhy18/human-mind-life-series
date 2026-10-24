import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Pencil, Plus, Search, ShoppingBag } from "lucide-react";
import { DeleteBookButton } from "@/components/admin/DeleteBookButton";
import { requireAdmin } from "@/lib/server/auth";
import { listDbBooks } from "@/lib/server/books";
import { deleteBookAction, toggleBookStatusAction } from "@/app/admin/books/actions";

export const dynamic = "force-dynamic";

export default async function AdminBooksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = sp.filter || "all";
  const q = (sp.q || "").toLowerCase().trim();
  const rawPage = parseInt(sp.page || "1", 10);
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const pageSize = 15;

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

  const totalFiltered = books.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const pagedBooks = books.slice((page - 1) * pageSize, page * pageSize);

  const stats = [
    { key: "all", href: "/admin/books", label: "All Books", count: allCount, Icon: BookOpen, tone: "bg-ink/10 text-ink", ring: "ring-ink" },
    { key: "sale", href: "/admin/books?filter=sale", label: "For Sale", count: saleCount, Icon: ShoppingBag, tone: "bg-gold/15 text-gold-dark", ring: "ring-gold" },
    { key: "free", href: "/admin/books?filter=free", label: "Free Downloads", count: freeCount, Icon: Download, tone: "bg-success/15 text-success", ring: "ring-success" },
  ];

  const buildPageUrl = (targetPage: number) => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (q) params.set("q", q);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/books?${qs}` : "/admin/books";
  };

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
        <Link
          href="/admin/books/new"
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold shadow-sm"
        >
          <Plus size={16} strokeWidth={2.5} />
          Add New Book
        </Link>
      </div>

      {/* Stat cards double as filter tabs */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {stats.map(({ key, href, label, count, Icon, tone, ring }) => {
          const active = filter === key;
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-xl border bg-white p-2.5 transition hover:shadow-md ${
                active ? `border-transparent ring-2 ${ring} shadow-sm` : "border-line"
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon size={20} />
              </span>
              <span>
                <span className="block text-xl font-bold leading-none text-ink">{count}</span>
                <span className="mt-1 block text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
              </span>
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <form className="mt-3.5 flex max-w-lg gap-2" action="/admin/books">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title, author or slug..."
            className="input py-2 pl-9"
          />
        </div>
        <button type="submit" className="btn-primary px-5 py-2 text-sm">
          Search
        </button>
      </form>

      {/* Books Table */}
      {pagedBooks.length === 0 ? (
        <div className="card mt-8 p-12 text-center text-muted">
          No books found matching your criteria.
        </div>
      ) : (
        <div className="card mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-line bg-cream/60 text-[0.7rem] font-semibold tracking-wider text-ink/60 uppercase">
                <tr>
                  <th className="px-3.5 py-2 text-xs font-semibold">Book</th>
                  <th className="px-3.5 py-2 text-xs font-semibold">Author</th>
                  <th className="px-3.5 py-2 text-right text-xs font-semibold">Price</th>
                  <th className="px-3.5 py-2 text-xs font-semibold">Availability</th>
                  <th className="px-3.5 py-2 text-xs font-semibold">PDF File</th>
                  <th className="px-3.5 py-2 text-right text-xs font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pagedBooks.map((b) => (
                  <tr key={b.id} className="align-middle transition-colors hover:bg-gold/5">
                    {/* Book Title & Vol */}
                    <td className="px-3.5 py-2 text-xs">
                      <div className="flex items-center gap-3.5">
                        <div
                          className="flex h-12 w-9 shrink-0 items-center justify-center rounded-md font-serif text-sm font-semibold text-white/90 uppercase shadow-sm"
                          style={{ backgroundColor: b.cover_bg || "#13233f" }}
                          title={`Theme: ${b.cover_bg}`}
                        >
                          {b.title.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium leading-snug text-ink">{b.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {b.volume != null && !b.hide_volume_label && (
                              <span className="whitespace-nowrap rounded-md bg-ink/5 px-1.5 py-0.5 text-[0.65rem] font-bold text-ink/70 uppercase">
                                Vol {b.volume}
                              </span>
                            )}
                            {b.adults_only && (
                              <span className="rounded-md bg-danger/10 px-1.5 py-0.5 text-[0.65rem] font-bold text-danger">
                                18+
                              </span>
                            )}
                            <span className="truncate font-mono text-xs text-muted">/books/{b.slug}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Author */}
                    <td className="whitespace-nowrap px-3.5 py-2 text-ink/80 text-xs">{b.author}</td>

                    {/* Pricing */}
                    <td className="whitespace-nowrap px-3.5 py-2 text-right text-xs">
                      {b.for_sale ? (
                        <div>
                          <span className="font-semibold text-ink">₹{b.price}</span>
                          {b.original_price != null && b.original_price > b.price && (
                            <span className="block text-xs text-muted line-through">₹{b.original_price}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>

                    {/* Distribution Status / Toggles */}
                    <td className="px-3.5 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <form action={toggleBookStatusAction}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="field" value="for_sale" />
                          <input type="hidden" name="value" value={b.for_sale ? "false" : "true"} />
                          <button
                            type="submit"
                            title="Click to toggle sale availability"
                            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition ${
                              b.for_sale
                                ? "border-gold/40 bg-gold/15 text-gold-dark hover:bg-gold/25"
                                : "border-line bg-paper text-muted hover:border-ink/40"
                            }`}
                          >
                            {b.for_sale ? "✓ For Sale" : "+ Sell"}
                          </button>
                        </form>

                        <form action={toggleBookStatusAction}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="field" value="is_free" />
                          <input type="hidden" name="value" value={b.is_free ? "false" : "true"} />
                          <button
                            type="submit"
                            title="Click to toggle free download access"
                            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition ${
                              b.is_free
                                ? "border-success/40 bg-success/15 text-success hover:bg-success/25"
                                : "border-line bg-paper text-muted hover:border-ink/40"
                            }`}
                          >
                            {b.is_free ? "✓ Free" : "+ Free"}
                          </button>
                        </form>
                      </div>
                    </td>

                    {/* Storage PDF */}
                    <td className="px-3.5 py-2 text-xs">
                      <a
                        href={`/api/admin/books/${b.slug}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        title={`Open ${b.pdf_filename}`}
                        className="group inline-flex max-w-[210px] items-center gap-2 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink/80 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                      >
                        <FileText size={14} className="shrink-0 text-danger/80" />
                        <span className="truncate font-mono">{b.pdf_filename}</span>
                        <ExternalLink size={12} className="shrink-0 text-muted group-hover:text-sky-700" />
                      </a>
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-2 text-xs">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/books/${b.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:border-sky-600 hover:bg-sky-600 hover:text-white"
                        >
                          <Pencil size={13} />
                          Edit
                        </Link>
                        <DeleteBookButton id={b.id} title={b.title} action={deleteBookAction} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-line bg-white px-4 py-3">
              <div className="text-xs text-muted">
                Page <strong className="text-ink">{page}</strong> of{" "}
                <strong className="text-ink">{totalPages}</strong> ({totalFiltered} books)
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={buildPageUrl(page - 1)}
                  aria-disabled={page <= 1}
                  tabIndex={page <= 1 ? -1 : undefined}
                  className={`inline-flex items-center gap-1 rounded-xl border border-line px-3 py-1.5 text-xs font-medium transition ${
                    page <= 1
                      ? "pointer-events-none opacity-40 bg-paper text-muted"
                      : "bg-white text-ink hover:bg-paper hover:border-ink/40"
                  }`}
                >
                  <ChevronLeft size={14} />
                  Previous
                </Link>
                <Link
                  href={buildPageUrl(page + 1)}
                  aria-disabled={page >= totalPages}
                  tabIndex={page >= totalPages ? -1 : undefined}
                  className={`inline-flex items-center gap-1 rounded-xl border border-line px-3 py-1.5 text-xs font-medium transition ${
                    page >= totalPages
                      ? "pointer-events-none opacity-40 bg-paper text-muted"
                      : "bg-white text-ink hover:bg-paper hover:border-ink/40"
                  }`}
                >
                  Next
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
