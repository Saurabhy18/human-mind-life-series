import Link from "next/link";
import { CONFIG, isPlaceholder } from "@/config/site.config";
import { PACKAGES, PACKAGE_IDS, type PackageId } from "@/config/packages";
import { ALL_BOOKS } from "@/lib/products";
import { whatsappLink } from "@/lib/contact";
import { translationOffered } from "@/config/env.server";
import { upiQrAvailable } from "@/lib/server/qr";
import { checkoutMode } from "@/lib/server/paymentService";
import { bookDeliverable } from "@/lib/server/translation/bookSource";
import { listDbBooks, dbBookToProductBook, getBookFromDbOrStatic } from "@/lib/server/books";
import { BookCover } from "@/components/BookCover";
import { TrackView } from "@/components/tracking/TrackView";
import { IconQr } from "@/components/icons";
import { PurchaseBuilder } from "./PurchaseBuilder";

/**
 * Checkout page body (server): the package builder with the payment method that is configured
 * (Cashfree, the opt-in manual UPI flow, or none = closed). Rendered per request, so payment
 * settings, book files and the QR file are always current.
 */
export async function CheckoutView({ packageId, books, lang, backHref }: { packageId: PackageId; books: string[]; lang: string | null; backHref: string }) {
  const dbBooks = listDbBooks();
  const allBooks = dbBooks.length > 0 ? dbBooks.map(dbBookToProductBook) : ALL_BOOKS;

  const packages = PACKAGE_IDS.map((id) => PACKAGES[id]).filter((p) => p.books >= 1 && p.books <= allBooks.length);
  const pkg = PACKAGES[packageId] ?? packages[0];
  const single = books.length === 1 && pkg.books === 1 ? getBookFromDbOrStatic(books[0]) : undefined;
  const tracked = single ? { slug: single.slug, label: single.label, price: pkg.price } : { slug: pkg.id, label: pkg.name, price: pkg.price };

  const mode = checkoutMode();
  const deliverable = await Promise.all(allBooks.map((b) => bookDeliverable(b)));
  const upiId = CONFIG.UPI_ID;
  const qr = mode !== "upi" ? null : upiQrAvailable() ? (
    <div className="rounded-2xl border border-line bg-white p-3">
      {/* Your original QR file, shown as-is: no regeneration, cropping, resizing service or recompression. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- must be served byte-for-byte unmodified */}
      <img src={CONFIG.UPI_QR_CODE} alt={`UPI QR code — pay to ${upiId}`} className="mx-auto block h-auto w-full max-w-full" decoding="sync" fetchPriority="high" />
    </div>
  ) : (
    <div className="flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gold/50 bg-cream p-6 text-sm text-muted">
      <IconQr width={40} height={40} className="text-gold-dark" />
      {process.env.NODE_ENV === "production"
        ? "QR code temporarily unavailable — please pay to the UPI ID below."
        : `Your UPI QR code will appear here. Copy your original QR image to public${CONFIG.UPI_QR_CODE || "/images/upi-qr.png"}.`}
    </div>
  );

  return (
    <>
      <TrackView event="begin_checkout" product={tracked} />
      <div className="container-page py-10 sm:py-14">
        <Link href={backHref} className="text-sm text-muted hover:text-ink">
          ← Back to {backHref === "/books" ? "books" : "book"}
        </Link>
        <h1 className="mt-4 text-4xl sm:text-5xl">Complete Your Purchase</h1>
        <div className="mt-10">
          <PurchaseBuilder
            books={allBooks.map((b, i) => ({
              slug: b.slug,
              title: b.title,
              label: b.label,
              volumeLabel: b.volumeLabel,
              author: b.author,
              cover: <BookCover book={b} size="xs" />,
              deliverable: deliverable[i],
              free: b.free,
            }))}
            packages={packages}
            individualPrice={PACKAGES.individual.price}
            initial={{ packageId: pkg.id, books, lang }}
            mode={mode}
            multilingual={translationOffered()}
            upi={mode === "upi" ? { upiId, upiConfigured: !isPlaceholder(upiId), qr, help: whatsappLink(`Hello, I need help with my payment for ${single?.label ?? pkg.name}.`) } : null}
          />
        </div>
      </div>
    </>
  );
}
