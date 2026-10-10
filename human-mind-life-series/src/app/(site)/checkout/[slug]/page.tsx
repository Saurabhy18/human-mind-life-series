import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { LANGUAGE_CODE_RE } from "@/config/languages";
import { PACKAGES } from "@/config/packages";
import { BUNDLE_SLUG, bundleEnabled, getFreeBook, getProduct } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";
import { CheckoutView } from "@/components/checkout/CheckoutView";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ lang?: string }> };

// Rendered per request so payment settings (UPI vs gateway) and the QR file are always current — no rebuild needed.
// Unknown slugs 404 and free books redirect to their free-copy form (see below).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  const title = slug === BUNDLE_SLUG ? PACKAGES.five_book_bundle.label : product?.title;
  if (!title) return {};
  return pageMetadata({
    title: `Complete Your Purchase — ${title}`,
    description: `Choose your ebooks and languages, then pay securely for ${title}.`,
    path: `/checkout/${slug}`,
    noIndex: true,
  });
}

/** /checkout/<book> starts checkout with that ebook (and ?lang=xx from the book page); /checkout/complete-series with the 5-book bundle. */
export default async function CheckoutPage({ params, searchParams }: Props) {
  const { slug } = await params;
  // A free book can NEVER show the payment page: send the reader to its free-copy form instead.
  if (getFreeBook(slug)) permanentRedirect(`/books/${slug}#get-free`);

  if (slug === BUNDLE_SLUG) {
    if (!bundleEnabled()) notFound();
    return <CheckoutView packageId="five_book_bundle" books={[]} lang={null} backHref="/books" />;
  }

  const product = getProduct(slug);
  if (!product) notFound();
  const { lang } = await searchParams;
  return <CheckoutView packageId="individual" books={[product.slug]} lang={typeof lang === "string" && LANGUAGE_CODE_RE.test(lang) ? lang : null} backHref={`/books/${product.slug}`} />;
}
