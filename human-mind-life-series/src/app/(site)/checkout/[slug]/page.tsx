import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CONFIG, isPlaceholder } from "@/config/site.config";
import { formatINR, getAllProducts, getBook, getFreeBook, getProduct } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";
import { upiPayLink, whatsappLink } from "@/lib/contact";
import { BookCover } from "@/components/BookCover";
import { CopyButton } from "@/components/checkout/CopyButton";
import { PaymentForm } from "@/components/checkout/PaymentForm";
import { TrackView } from "@/components/tracking/TrackView";
import { upiQrAvailable } from "@/lib/server/qr";
import { gatewayEnabled } from "@/lib/server/paymentService";
import { GatewayCheckout } from "@/components/checkout/GatewayCheckout";
import { IconPhone, IconQr, IconShield, IconWhatsApp } from "@/components/icons";

type Props = { params: Promise<{ slug: string }> };

// Rendered per request so payment settings (UPI vs gateway) and the QR file are always current — no rebuild needed.
// Unknown slugs 404 and free books redirect to their free-copy form (see below).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = getProduct((await params).slug);
  if (!product) return {};
  return pageMetadata({
    title: `Complete Your Purchase — ${product.title}`,
    description: `Pay for ${product.label} securely by UPI.`,
    path: `/checkout/${product.slug}`,
    noIndex: true,
  });
}

export default async function CheckoutPage({ params }: Props) {
  const { slug } = await params;
  const product = getProduct(slug);
  // A free book can NEVER show the payment page: send the reader to its free-copy form instead.
  if (getFreeBook(slug)) permanentRedirect(`/books/${slug}#get-free`);
  if (!product) notFound();

  const book = getBook(slug);
  const products = getAllProducts();
  const upiId = CONFIG.UPI_ID;
  const upiConfigured = !isPlaceholder(upiId);
  const payLink = CONFIG.ENABLE_UPI_APP_BUTTON ? upiPayLink(product.price, product.title) : null;
  if (gatewayEnabled() && book) {
    return (
      <>
        <TrackView event="begin_checkout" product={{ slug: product.slug, label: product.label, price: product.price }} />
        <div className="container-page py-10 sm:py-14">
          <Link href={`/books/${book.slug}`} className="text-sm text-muted hover:text-ink">← Back to book</Link>
          <h1 className="mt-4 text-4xl sm:text-5xl">Complete Your Purchase</h1>
          <div className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
            <div className="card flex items-center gap-5 self-start p-5">
              <div className="w-20 shrink-0">
                <BookCover book={book} size="xs" />
              </div>
              <dl className="min-w-0 flex-1 text-sm">
                <dt className="text-muted">Book</dt>
                <dd className="font-medium">{product.label}</dd>
                <dt className="mt-2 text-muted">Author</dt>
                <dd className="font-medium">{product.author}</dd>
                <dt className="mt-2 text-muted">Price</dt>
                <dd className="font-serif text-2xl">{formatINR(product.price)}</dd>
              </dl>
            </div>
            <section className="card p-6 sm:p-8" aria-labelledby="gw">
              <h2 id="gw" className="text-2xl">Available in multiple languages</h2>
              <div className="mt-6">
                <GatewayCheckout bookSlug={book.slug} price={product.price} />
              </div>
            </section>
          </div>
        </div>
      </>
    );
  }

  const qrReady = upiQrAvailable();
  const help = whatsappLink(`Hello, I need help with my payment for ${product.label}.`);

  return (
    <>
      <TrackView event="begin_checkout" product={{ slug: product.slug, label: product.label, price: product.price }} />

      <div className="container-page py-10 sm:py-14">
        <Link href={book ? `/books/${book.slug}` : "/books"} className="text-sm text-muted hover:text-ink">
          ← Back to {book ? "book" : "books"}
        </Link>
        <h1 className="mt-4 text-4xl sm:text-5xl">Complete Your Purchase</h1>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          {/* ---------------------------------------------- Step 1: Pay */}
          <section aria-labelledby="pay" className="space-y-6">
            <div className="card flex items-center gap-5 p-5">
              {book && (
                <div className="w-16 shrink-0">
                  <BookCover book={book} size="xs" />
                </div>
              )}
              <dl className="min-w-0 flex-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Book:</dt>
                  <dd className="text-right font-medium">{product.label}</dd>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <dt className="text-muted">Author:</dt>
                  <dd className="text-right font-medium">{product.author}</dd>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-2">
                  <dt className="text-muted">Price:</dt>
                  <dd className="font-serif text-2xl">{formatINR(product.price)}</dd>
                </div>
              </dl>
            </div>

            <div className="card p-6 text-center sm:p-8">
              <p className="eyebrow">Step 1 · Pay by UPI</p>
              <h2 id="pay" className="mt-2 text-2xl">Scan the QR code below using any supported UPI app.</h2>

              <div className="mx-auto mt-6 w-full max-w-[340px]">
                {qrReady ? (
                  <div className="rounded-2xl border border-line bg-white p-3">
                    {/* Your original QR file, shown as-is: no regeneration, cropping, resizing service or recompression. */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- must be served byte-for-byte unmodified */}
                    <img
                      src={CONFIG.UPI_QR_CODE}
                      alt={`UPI QR code — pay to ${upiId}`}
                      className="mx-auto block h-auto w-full max-w-full"
                      decoding="sync"
                      fetchPriority="high"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gold/50 bg-cream p-6 text-sm text-muted">
                    <IconQr width={40} height={40} className="text-gold-dark" />
                    {process.env.NODE_ENV === "production"
                      ? "QR code temporarily unavailable — please pay to the UPI ID below."
                      : `Your UPI QR code will appear here. Copy your original QR image to public${CONFIG.UPI_QR_CODE || "/images/upi-qr.png"}.`}
                  </div>
                )}
              </div>

              <p className="mt-6 text-sm text-muted">Amount to pay</p>
              <p className="font-serif text-4xl">{formatINR(product.price)}</p>

              <div className="mx-auto mt-5 flex max-w-sm items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3 text-left">
                <div className="min-w-0">
                  <p className="text-xs text-muted">UPI ID:</p>
                  <p className="font-mono text-sm font-semibold break-all">{upiId}</p>
                </div>
                {upiConfigured && <CopyButton value={upiId} />}
              </div>

              {payLink && (
                <a href={payLink} className="btn-gold mt-5 w-full max-w-sm py-4 text-base md:hidden">
                  <IconPhone /> Pay {formatINR(product.price)} with a UPI app
                </a>
              )}

              <p className="mt-6 text-xs text-muted">Google Pay · PhonePe · Paytm · BHIM · any bank UPI app</p>
            </div>

            <ol className="space-y-3 text-sm text-ink/80">
              {[
                `Pay exactly ${formatINR(product.price)} by scanning the QR code or paying to the UPI ID.`,
                "Note the UTR / Transaction ID shown in your UPI app and take a screenshot.",
                "Fill in the “Payment completed?” form and submit.",
                `We verify your payment and send your book ${CONFIG.DELIVERY_TIMEFRAME}.`,
              ].map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* ------------------------------------- Step 2: Submit details */}
          <section aria-labelledby="details" className="card h-fit p-6 sm:p-8 lg:sticky lg:top-28">
            <p className="eyebrow">Step 2 · Confirm your payment</p>
            <h2 id="details" className="mt-2 text-3xl">Payment completed?</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">After completing your payment, enter your transaction details below.</p>

            <div className="mt-5 flex gap-3 rounded-xl border border-gold/30 bg-cream px-4 py-3 text-sm text-ink/85">
              <IconShield className="mt-0.5 shrink-0 text-gold-dark" />
              <p>
                <strong>Your payment will be manually verified before your book is delivered.</strong> Payments are never confirmed automatically. We will never ask for your UPI PIN, OTP or bank password.
              </p>
            </div>

            <div className="mt-6">
              <PaymentForm products={products} initialSlug={product.slug} upiId={upiId} />
            </div>

            {help && (
              <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
                Need help?{" "}
                <a href={help} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-ink hover:text-gold-dark">
                  <IconWhatsApp width={16} /> Chat with us on WhatsApp
                </a>
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
