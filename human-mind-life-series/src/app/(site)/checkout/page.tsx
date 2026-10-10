import type { Metadata } from "next";
import { LANGUAGE_CODE_RE } from "@/config/languages";
import { getPackage } from "@/config/packages";
import { getProduct, packageAvailable } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";
import { CheckoutView } from "@/components/checkout/CheckoutView";

type Props = { searchParams: Promise<{ package?: string; book?: string; lang?: string }> };

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Complete Your Purchase",
  description: "Choose one ebook, any 3 or all 5, pick a language for each ebook and pay securely.",
  path: "/checkout",
  noIndex: true,
});

/** /checkout?package=three_book_bundle&book=<slug>&lang=xx — checkout with a package (and optionally a book) already chosen. */
export default async function PackageCheckoutPage({ searchParams }: Props) {
  const sp = await searchParams;
  const pkg = getPackage(sp.package);
  const product = typeof sp.book === "string" ? getProduct(sp.book) : undefined;
  const lang = typeof sp.lang === "string" && LANGUAGE_CODE_RE.test(sp.lang) ? sp.lang : null;
  return (
    <CheckoutView
      packageId={pkg && packageAvailable(pkg) ? pkg.id : "individual"}
      books={product ? [product.slug] : []}
      lang={lang}
      backHref={product ? `/books/${product.slug}` : "/books"}
    />
  );
}
