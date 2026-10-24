import Link from "next/link";
import { BookPrice } from "../BookPrice";
import { bookActionHref, bookActionLabel, type Book } from "@/lib/products";

/** Fixed "Buy Now" / "GET FREE BOOK" bar on phones, so the main button is always within reach. */
export function StickyBuyBar({ book }: { book: Book }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted">{book.volumeLabel ? `Vol. ${book.volume} — ${book.title}` : book.title}</p>
          <p className={`font-serif text-xl ${book.free ? "font-semibold text-success" : ""}`}><BookPrice book={book} size="sm" /></p>
        </div>
        <Link href={bookActionHref(book)} className={`${book.free ? "btn-free" : "btn-primary"} shrink-0 px-7`}>
          {bookActionLabel(book)}
        </Link>
      </div>
    </div>
  );
}
