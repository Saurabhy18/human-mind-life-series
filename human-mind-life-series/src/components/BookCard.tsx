import Link from "next/link";
import { CONFIG } from "@/config/site.config";
import { BookCover } from "./BookCover";
import { BookPrice } from "./BookPrice";
import { bookActionHref, bookActionLabel, type Book } from "@/lib/products";

export function BookCard({ book, headingLevel = "h3" }: { book: Book; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <article className={`card lift relative flex h-full flex-col overflow-hidden ${book.free ? "border-success/40 ring-1 ring-success/20" : ""}`}>
      {book.free && <span className="free-badge absolute top-4 right-4 z-10">Free Book</span>}
      <Link href={`/books/${book.slug}`} className="block bg-cream px-10 pt-10 pb-8" aria-label={`View ${book.label}`}>
        <div className="mx-auto max-w-[200px]">
          <BookCover book={book} size="sm" />
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-6">
        {book.volumeLabel && <p className="eyebrow">{book.volumeLabel}</p>}
        <Heading className={`${book.volumeLabel ? "mt-2" : ""} text-xl leading-snug`}>
          <Link href={`/books/${book.slug}`} className="hover:text-gold-dark">
            {book.title}
          </Link>
        </Heading>
        <p className="mt-1.5 text-sm text-ink/75">
          by <span className="font-medium text-ink">{book.author}</span>
        </p>
        {book.adultsOnly && <p className="mt-1 text-xs font-medium text-muted">For adult readers (18+)</p>}
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{book.shortDescription}</p>
        <div className="mt-5 flex items-baseline justify-between border-t border-line pt-5">
          <BookPrice book={book} priceClassName={`font-serif text-2xl ${book.free ? "font-semibold tracking-wide text-success" : ""}`} />
          <span className="text-xs text-muted">{CONFIG.BOOK_FORMAT}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href={`/books/${book.slug}`} className="btn-outline px-3">
            View Book
          </Link>
          <Link href={bookActionHref(book)} className={book.free ? "btn-free px-3 text-xs sm:text-sm" : "btn-primary px-3"}>
            {bookActionLabel(book)}
          </Link>
        </div>
      </div>
    </article>
  );
}
