import Link from "next/link";
import type { Metadata } from "next";
import { getGeneralFaqs } from "@/content/faqs";
import { checkoutMode } from "@/lib/server/paymentService";
import { breadcrumbSchema, faqSchema, pageMetadata } from "@/lib/seo";
import { FaqList } from "@/components/FaqList";
import { GeneralDisclaimer } from "@/components/GeneralDisclaimer";
import { JsonLd } from "@/components/JsonLd";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = pageMetadata({
  title: "Frequently Asked Questions",
  description: "How to buy, pay for and receive your books from The Human Mind & Life Series.",
  path: "/faq",
});

export default function FaqPage() {
  const faqs = getGeneralFaqs(checkoutMode());
  return (
    <>
      <JsonLd data={[faqSchema(faqs), breadcrumbSchema([{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }])]} />
      <PageHeader eyebrow="Help" title="Frequently asked questions" intro="Everything you need to know about buying, paying for and receiving your books." />
      <section className="container-page max-w-3xl py-16 sm:py-20">
        <FaqList items={faqs} />
        <GeneralDisclaimer className="mt-12" />
        <div className="mt-12 rounded-2xl border border-line bg-white p-8 text-center">
          <h2 className="text-2xl">Still have a question?</h2>
          <p className="mt-2 text-muted">We are happy to help.</p>
          <Link href="/contact" className="btn-primary mt-6">
            Contact us
          </Link>
        </div>
      </section>
    </>
  );
}
