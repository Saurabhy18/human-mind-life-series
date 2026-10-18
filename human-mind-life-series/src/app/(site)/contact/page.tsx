import type { Metadata } from "next";
import { BUSINESS_EMAIL, CONFIG, isPlaceholder } from "@/config/site.config";
import { mailtoLink, whatsappLink } from "@/lib/contact";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { ContactForm } from "@/components/contact/ContactForm";
import { JsonLd } from "@/components/JsonLd";
import { PageHeader } from "@/components/PageHeader";
import { SocialLinks } from "@/components/SocialLinks";
import { IconMail, IconWhatsApp } from "@/components/icons";

export const metadata: Metadata = pageMetadata({
  title: "Contact Us",
  description: "Contact The Human Mind & Life Series for order support, general questions and business enquiries by email, WhatsApp or our contact form.",
  path: "/contact",
});

export default function ContactPage() {
  const wa = whatsappLink("Hello, I have a question about The Human Mind & Life Series.");
  const email = mailtoLink(CONFIG.AUTHOR_EMAIL);
  const business = mailtoLink(BUSINESS_EMAIL, "Business enquiry");

  return (
    <>
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "ContactPage", name: "Contact", url: "/contact" },
          breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]),
        ]}
      />
      <PageHeader eyebrow="Contact" title="Get in touch" intro="Questions about a book, help with an order, or a business enquiry — we would be glad to hear from you." />

      <section className="container-page grid gap-10 py-16 sm:py-20 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-5">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <IconMail className="text-gold-dark" />
              <h2 className="font-sans text-base font-semibold">Email</h2>
            </div>
            {email ? (
              <a href={email} className="mt-3 block break-all text-lg font-medium hover:text-gold-dark">{CONFIG.AUTHOR_EMAIL}</a>
            ) : (
              <p className="mt-3 text-muted">{CONFIG.AUTHOR_EMAIL}</p>
            )}
            <p className="mt-1 text-sm text-muted">For questions and order support.</p>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <IconWhatsApp className="text-gold-dark" />
              <h2 className="font-sans text-base font-semibold">WhatsApp</h2>
            </div>
            {wa ? (
              <>
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4">
                  <IconWhatsApp /> Chat on WhatsApp
                </a>
                <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-3 block text-lg font-medium hover:text-gold-dark">
                  +91 {CONFIG.WHATSAPP_NUMBER.replace(/^91/, "")}
                </a>
              </>
            ) : (
              <p className="mt-3 text-muted">{CONFIG.WHATSAPP_NUMBER}</p>
            )}
            <p className="mt-3 text-sm text-muted">The quickest way to reach us about an order. Please include your order reference.</p>
          </div>

          <div className="card p-6">
            <h2 className="font-sans text-base font-semibold">Business enquiries</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              For bulk or institutional purchases, collaborations, media and interview requests, use the form (choose “Business enquiry”) or email us.
            </p>
            {business && !isPlaceholder(BUSINESS_EMAIL) && (
              <a href={business} className="mt-3 inline-block font-medium break-all hover:text-gold-dark">{BUSINESS_EMAIL}</a>
            )}
          </div>

          <div className="px-1">
            <p className="mb-3 text-sm font-medium">Follow the series</p>
            <SocialLinks />
          </div>
        </div>

        <div className="card p-6 sm:p-8">
          <h2 className="text-2xl">Send us a message</h2>
          <p className="mt-1 text-sm text-muted">We usually reply by email. Fields marked * are required.</p>
          <div className="mt-6">
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
