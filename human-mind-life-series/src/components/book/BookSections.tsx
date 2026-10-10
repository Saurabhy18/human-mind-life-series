import Link from "next/link";
import { BUSINESS_EMAIL, CONFIG } from "@/config/site.config";
import { mailtoLink, whatsappLink } from "@/lib/contact";
import { formatINR, type Book } from "@/lib/products";
import type { FaqItem } from "@/content/books";
import { IconCheck, IconMail, IconWhatsApp } from "../icons";

export function LearnList({ book }: { book: Book }) {
  if (!book.learn.length) return null;
  return (
    <section aria-labelledby="learn">
      <h2 id="learn" className="text-2xl sm:text-3xl">What you will learn</h2>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {book.learn.map((item) => (
          <li key={item} className="flex gap-3 rounded-xl border border-line bg-white p-4">
            <IconCheck className="mt-0.5 shrink-0 text-gold" />
            <span className="leading-relaxed text-ink/85">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TopicList({ book }: { book: Book }) {
  if (!book.topics.length) return null;
  return (
    <section aria-labelledby="topics">
      <h2 id="topics" className="text-2xl sm:text-3xl">Key topics</h2>
      <ul className="mt-5 flex flex-wrap gap-2.5">
        {book.topics.map((t) => (
          <li key={t} className="rounded-full border border-gold/30 bg-cream px-4 py-2 text-sm text-ink/85">
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TableOfContents({ book }: { book: Book }) {
  if (!book.toc.length) return null;
  return (
    <section aria-labelledby="contents">
      <h2 id="contents" className="text-2xl sm:text-3xl">Contents</h2>
      <ol className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white">
        {book.toc.map((chapter, i) => (
          <li key={chapter} className="flex gap-4 px-5 py-4">
            <span className="w-8 shrink-0 font-serif text-gold-dark">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-ink/85">{chapter}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Shows your preview excerpt, or an offer to send a free sample on request. */
export function SamplePreview({ book }: { book: Book }) {
  if (book.sample) {
    return (
      <section aria-labelledby="sample">
        <h2 id="sample" className="text-2xl sm:text-3xl">Read a preview</h2>
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-line bg-white px-6 py-8 sm:px-10">
          <p className="eyebrow">{book.sample.heading}</p>
          <div className="mt-4 space-y-4 font-serif text-lg leading-relaxed text-ink/85">
            {book.sample.paragraphs.map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
        </div>
      </section>
    );
  }

  const wa = whatsappLink(`Hello, I would like a free sample of "${book.label}".`);
  const mail = mailtoLink(BUSINESS_EMAIL, `Sample request: ${book.title}`, `Hello, I would like a free sample of "${book.label}".`);
  return (
    <section aria-labelledby="sample">
      <h2 id="sample" className="text-2xl sm:text-3xl">Preview this book</h2>
      <div className="mt-6 rounded-2xl border border-dashed border-gold/50 bg-cream/60 p-6 sm:p-8">
        <p className="leading-relaxed text-ink/85">Would you like to read a sample before you buy? Send us a message and we will share a preview of this volume with you.</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline">
              <IconWhatsApp /> Request on WhatsApp
            </a>
          )}
          {mail && (
            <a href={mail} className="btn-outline">
              <IconMail /> Request by email
            </a>
          )}
          {!wa && !mail && (
            <Link href="/contact" className="btn-outline">
              Contact us for a sample
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export function Disclaimer({ book }: { book: Book }) {
  if (!book.disclaimer) return null;
  return (
    <aside aria-label="Disclaimer" className="rounded-2xl border border-line bg-white p-6 text-sm leading-relaxed text-muted">
      <p className="mb-1 font-semibold text-ink">Disclaimer</p>
      {book.disclaimer}
    </aside>
  );
}

export function bookFaqs(book: Book): FaqItem[] {
  if (book.free) {
    return [
      ...book.faqs,
      {
        q: "What format is the book in?",
        a: `It is a ${CONFIG.BOOK_FORMAT} that you can read on your phone, tablet or computer.`,
      },
      {
        q: "How do I get my free copy?",
        a: "Click “GET FREE BOOK”, enter your name and email address (WhatsApp is optional) and submit the form. No payment, QR code, UTR or screenshot is needed.",
      },
      {
        q: "How will I receive it?",
        a: CONFIG.FREE_BOOK_INSTANT_DOWNLOAD
          ? `Right after you submit the form you get a personal download link, valid for ${CONFIG.FREE_DOWNLOAD_LINK_HOURS} hours. If the link is not available, we send your copy to your email or WhatsApp.`
          : "We send your free copy to the email address (and WhatsApp number, if provided) that you enter in the form.",
      },
    ];
  }
  return [
    ...book.faqs,
    {
      q: "What format is the book in?",
      a: `It is a ${CONFIG.BOOK_FORMAT} that you can read on your phone, tablet or computer.`,
    },
    {
      q: "How do I buy this book?",
      a: `Click “Buy Now”, pay ${formatINR(book.price)} by scanning our UPI QR code, then submit your name, email, WhatsApp number, UTR / Transaction ID and payment screenshot on the same page.`,
    },
    {
      q: "When will I receive it?",
      a: `Every payment is verified manually. Your book will be sent to your email and/or WhatsApp ${CONFIG.DELIVERY_TIMEFRAME}.`,
    },
  ];
}
