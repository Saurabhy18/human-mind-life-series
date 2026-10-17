import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { getDbBookById } from "@/lib/server/books";
import { BookForm } from "@/components/admin/BookForm";
import { updateBookAction, deleteBookAction } from "@/app/admin/books/actions";

export const dynamic = "force-dynamic";

export default async function EditBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) notFound();

  const book = getDbBookById(id);
  if (!book) notFound();

  const boundUpdateAction = updateBookAction.bind(null, id);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-xs text-muted mb-2">
            <Link href="/admin/books" className="hover:text-ink">
              Books
            </Link>
            <span>/</span>
            <span className="text-ink">Edit Book</span>
          </nav>
          <h1 className="font-serif text-3xl font-medium text-ink">
            Edit: {book.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Update pricing, distribution status (free download / for sale), metadata, or replace the manuscript PDF.
          </p>
        </div>

        {/* Delete button */}
        <form action={deleteBookAction}>
          <input type="hidden" name="id" value={book.id} />
          <button
            type="submit"
            className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-2 text-xs font-semibold text-danger hover:bg-danger hover:text-white transition"
          >
            Delete This Book
          </button>
        </form>
      </div>

      {/* Book Form */}
      <BookForm initialData={book} isEdit={true} action={boundUpdateAction} />
    </div>
  );
}
