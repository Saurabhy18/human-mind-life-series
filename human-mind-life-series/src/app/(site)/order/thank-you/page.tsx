import Link from "next/link";
import type { Metadata } from "next";
import { BUSINESS_EMAIL, CONFIG } from "@/config/site.config";
import { getPackage } from "@/config/packages";
import { getProduct } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";
import { mailtoLink, whatsappLink } from "@/lib/contact";
import { TrackSubmission } from "@/components/tracking/TrackSubmission";
import { IconCheck, IconClock, IconMail, IconWhatsApp } from "@/components/icons";
import { OrderStatusLink } from "@/components/translation/OrderStatusLink";

export const metadata: Metadata = pageMetadata({
  title: "Thank You for Your Purchase",
  description: "Your payment details have been submitted.",
  path: "/order/thank-you",
  noIndex: true,
});

type Props = { searchParams: Promise<{ ref?: string; book?: string; package?: string }> };

export default async function ThankYouPage({ searchParams }: Props) {
  const sp = await searchParams;
  // Only a public order reference is shown — never any customer information.
  const ref = typeof sp.ref === "string" && /^HM-[A-Z0-9]{8}$/.test(sp.ref) ? sp.ref : null;
  const book = typeof sp.book === "string" ? getProduct(sp.book) : undefined;
  const pkg = getPackage(sp.package ?? "individual");
  // What was ordered, for the order card and conversion tracking (the price is the package price).
  const product = pkg && pkg.books > 1 ? { slug: pkg.id, label: pkg.name, price: pkg.price } : book && pkg ? { slug: book.slug, label: book.label, price: pkg.price } : undefined;

  const wa = whatsappLink(ref ? `Hello, I have submitted my payment details. Order reference: ${ref}` : undefined);
  const mail = mailtoLink(BUSINESS_EMAIL, ref ? `Order ${ref}` : "My order");

  return (
    <div className="container-page py-16 sm:py-24">
      {ref && product && <TrackSubmission product={{ slug: product.slug, label: product.label, price: product.price }} orderRef={ref} />}

      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-16 w-16 animate-fade-up items-center justify-center rounded-full bg-success/10 text-success">
          <IconCheck width={32} height={32} />
        </div>
        <h1 className="mt-6 animate-fade-up text-4xl sm:text-5xl">Thank You for Your Purchase!</h1>
        <p className="mt-5 animate-fade-up text-lg leading-relaxed text-muted">
          Your payment details have been submitted successfully. Once we verify your payment, your ebooks are prepared in the languages you chose and delivered to you.
        </p>

        {ref && (
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-line bg-white p-6">
            <p className="text-sm text-muted">Your order reference</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-wider">{ref}</p>
            {product && <p className="mt-2 text-sm text-muted">{product.label}</p>}
            <p className="mt-3 text-xs text-muted">Please keep this reference for any questions about your order.</p>
          </div>
        )}
        {ref && <OrderStatusLink orderRef={ref} />}

        <div className="mt-10 grid gap-4 text-left sm:grid-cols-2">
          <div className="card flex gap-4 p-5">
            <IconClock className="mt-0.5 shrink-0 text-gold-dark" />
            <div>
              <h2 className="font-sans text-sm font-semibold">
                Order Status: <span className="tracking-wide text-gold-dark">PENDING VERIFICATION</span>
              </h2>
              <p className="mt-1 text-sm text-muted">Your payment is checked manually. Your order is not confirmed until verification is complete.</p>
            </div>
          </div>
          <div className="card flex gap-4 p-5">
            <IconMail className="mt-0.5 shrink-0 text-gold-dark" />
            <div>
              <h2 className="font-sans text-sm font-semibold">Delivery</h2>
              <p className="mt-1 text-sm text-muted">Your {CONFIG.BOOK_FORMAT} will be ready {CONFIG.DELIVERY_TIMEFRAME}. Download it from your order page, or we will send it to your email / WhatsApp.</p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline">
              <IconWhatsApp /> Contact us on WhatsApp
            </a>
          )}
          {mail && (
            <a href={mail} className="btn-outline">
              <IconMail /> Email us
            </a>
          )}
          <Link href="/books" className="btn-primary">
            Explore more books
          </Link>
        </div>
      </div>
    </div>
  );
}
