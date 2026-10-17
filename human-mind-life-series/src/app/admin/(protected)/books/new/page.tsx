import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { BookForm } from "@/components/admin/BookForm";
import { createBookAction } from "@/app/admin/books/actions";

export const dynamic = "force-dynamic";

export default async function NewBookPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Header */}
      <div>
        <nav className="flex items-center gap-2 text-xs text-muted mb-2">
          <Link href="/admin/books" className="hover:text-ink">
            Books
          </Link>
          <span>/</span>
          <span className="text-ink">New Book</span>
        </nav>
        <h1 className="font-serif text-3xl font-medium text-ink">Add New Book</h1>
        <p className="mt-1 text-sm text-muted">
          Add a new book to the catalogue for sale or free download. The PDF manuscript will be stored in Supabase Storage.
        </p>
      </div>

      {/* Book Form */}
      <BookForm isEdit={false} action={createBookAction} />
    </div>
  );
}
