"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_LANGUAGE } from "@/config/languages";
import { formatMoney, type PackageId, type PurchasePackage, type PurchaseSelection } from "@/config/packages";
import { useAuth } from "@/components/auth/AuthContext";
import { IconArrowRight, IconCheck, IconShield } from "../icons";
import { Price } from "../Price";
import { ChargedInInrNote } from "../currency/ChargedInInrNote";
import { OfferCountdown } from "../OfferCountdown";
import { LanguageSelector, useLanguageNames } from "../translation/LanguageSelector";
import { GatewayCheckout } from "./GatewayCheckout";
import { UpiPayment, type UpiSettings } from "./UpiPayment";

export type CheckoutBook = {
  slug: string;
  title: string;
  label: string;
  volumeLabel: string | null;
  author: string;
  cover: React.ReactNode;
  /** False when the book's PDF is not on the server (or is unreadable): it cannot be ordered yet. */
  deliverable: boolean;
  free?: boolean;
};

type Props = {
  /** Paid books, in series order. */
  books: CheckoutBook[];
  packages: PurchasePackage[];
  /** Price of one ebook, to show what a bundle saves. */
  individualPrice: number;
  initial: { packageId: PackageId; books: string[]; lang: string | null };
  /** closed = no payment provider configured: prices can be reviewed, nothing can be paid. */
  mode: "upi" | "gateway" | "closed";
  /** False = every ebook is sold in English only (translated editions not switched on). */
  multilingual: boolean;
  upi: UpiSettings | null;
};

const NOT_AVAILABLE = "Not available for online purchase yet";
const CLOSED = "Online checkout is not open yet. You can review the packages and prices, but no payment can be made on this website at the moment.";

/**
 * Checkout: choose a package → select its ebooks → a language for each → order summary → pay.
 * The browser only sends the package, book ids and languages; the server checks them and sets the price.
 */
export function PurchaseBuilder({ books, packages, individualPrice, initial, mode, multilingual, upi }: Props) {
  const { user, loading } = useAuth();
  const [packageId, setPackageId] = useState<PackageId>(initial.packageId);
  const pkg = packages.find((p) => p.id === packageId) ?? packages[0];
  const includesAll = pkg.books === books.length;
  const canOrder = (slug: string) => books.some((b) => b.slug === slug && b.deliverable);
  const [picked, setPicked] = useState<string[]>(() => {
    if (pkg.books === books.length) return books.map((b) => b.slug);
    const valid = initial.books.filter(canOrder);
    if (valid.length >= pkg.books) return valid.slice(0, pkg.books);
    const remaining = books.filter((b) => b.deliverable && !valid.includes(b.slug));
    return [...valid, ...remaining.slice(0, pkg.books - valid.length).map((b) => b.slug)];
  });
  // Language code per book (English by default; a language chosen on the book page arrives as ?lang=xx).
  const [langs, setLangs] = useState<Record<string, string>>(() => Object.fromEntries(initial.books.map((slug) => [slug, initial.lang ?? DEFAULT_LANGUAGE.code])));
  const languageName = useLanguageNames();
  const [step, setStep] = useState<"choose" | "pay">("choose");
  /** Why "Proceed to Payment" did not continue (shown in the summary). */
  const [notice, setNotice] = useState("");
  /** Shown next to the book list, e.g. when a 4th book is clicked for a 3-book bundle. */
  const [bookNotice, setBookNotice] = useState(() => {
    const unavailable = books.find((b) => initial.books.includes(b.slug) && !b.deliverable);
    return unavailable ? `“${unavailable.title}” is not available for online purchase yet.` : "";
  });
  const payRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("hm:pending-checkout");
      if (saved) {
        const parsed = JSON.parse(saved) as PurchaseSelection;
        if (parsed.packageId && packages.some((p) => p.id === parsed.packageId)) {
          setPackageId(parsed.packageId);
        }
        if (parsed.items?.length) {
          const itemSlugs = parsed.items.map((i) => i.bookId).filter((slug) => books.some((b) => b.slug === slug && b.deliverable));
          if (itemSlugs.length > 0) setPicked(itemSlugs);
          const langMap: Record<string, string> = {};
          parsed.items.forEach((i) => {
            if (i.language) langMap[i.bookId] = i.language;
          });
          setLangs((prev) => ({ ...prev, ...langMap }));
        }
        sessionStorage.removeItem("hm:pending-checkout");
      }
    } catch {}
  }, [books, packages]);

  const selected = books.filter((b) => picked.includes(b.slug)); // always in series order
  const complete = selected.length === pkg.books;
  const orderable = books.filter((b) => b.deliverable).length;
  // A package can only be paid for when every ebook in it can be delivered.
  const packageBlocked = includesAll ? orderable < books.length : orderable < pkg.books;
  const packageNotice = !packageBlocked
    ? ""
    : includesAll
      ? `The ${pkg.name} can be bought once every ebook in it is available for online purchase.`
      : orderable === 0
        ? "No ebook can be bought online right now."
        : `Only ${orderable} ebook${orderable === 1 ? "" : "s"} can be bought online right now, so the ${pkg.name} can’t be completed yet.`;
  const canPay = mode !== "closed" && complete && !packageBlocked && selected.every((b) => b.deliverable);
  const lang = (slug: string) => (multilingual ? (langs[slug] ?? DEFAULT_LANGUAGE.code) : DEFAULT_LANGUAGE.code);
  const selection: PurchaseSelection = { packageId: pkg.id, items: selected.map((b) => ({ bookId: b.slug, language: lang(b.slug) })) };
  const summaryItems = selected.map((b) => ({ slug: b.slug, title: b.label, language: languageName(lang(b.slug)) }));
  const summary = `${pkg.name} — ${selected.map((b) => `${b.volumeLabel ?? b.title} (${languageName(lang(b.slug))})`).join(", ")}`;

  const onLanguage = useCallback((slug: string, code: string) => setLangs((l) => ({ ...l, [slug]: code })), []);

  function choosePackage(next: PurchasePackage) {
    setPackageId(next.id);
    setNotice("");
    setBookNotice("");
    setPicked((prev) => {
      if (next.books === books.length) return books.map((b) => b.slug);
      const valid = prev.filter(canOrder);
      if (valid.length >= next.books) return valid.slice(0, next.books);
      const remaining = books.filter((b) => b.deliverable && !valid.includes(b.slug));
      return [...valid, ...remaining.slice(0, next.books - valid.length).map((b) => b.slug)];
    });
  }

  function toggleBook(slug: string) {
    setNotice("");
    setBookNotice("");
    if (includesAll) return;
    if (!canOrder(slug)) setBookNotice(`“${books.find((b) => b.slug === slug)?.title}” is not available for online purchase yet.`);
    else if (picked.includes(slug)) setPicked(picked.filter((s) => s !== slug));
    else if (pkg.books === 1) setPicked([slug]);
    else if (picked.length >= pkg.books) setBookNotice(`You have already selected ${pkg.books} ebooks. Remove one to choose another.`);
    else setPicked([...picked, slug]);
  }

  function proceed() {
    if (packageBlocked) {
      setNotice(packageNotice);
      return;
    }
    if (!complete) {
      setNotice(pkg.books === 1 ? "Please select 1 ebook." : `Please select exactly ${pkg.books} ebooks for this bundle.`);
      return;
    }
    if (mode === "closed") {
      setNotice(CLOSED);
      return;
    }
    if (selection.items.some((i) => !i.language)) {
      setNotice("Please select a language for each ebook.");
      return;
    }
    setStep("pay");
    setTimeout(() => payRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const heading = pkg.books === 1 ? "Select 1 Ebook" : includesAll ? pkg.label : `Select exactly ${pkg.books} ebooks`;

  if (step === "pay") {
    return (
      <div ref={payRef} className="scroll-mt-28">
        <OrderSummary pkg={pkg} items={summaryItems}>
          <button type="button" onClick={() => setStep("choose")} className="btn-outline mt-5 w-full">
            Change selection
          </button>
        </OrderSummary>
        <div className="mt-8">
          {mode === "gateway" ? (
            <section className="card p-6 sm:p-8" aria-labelledby="gw">
              <p className="eyebrow">Step 4 · Payment</p>
              <h2 id="gw" className="mt-2 text-2xl">Pay securely</h2>
              <div className="mt-6">
                <GatewayCheckout selection={selection} amount={pkg.price} currency={pkg.currency} />
              </div>
            </section>
          ) : (
            upi && <UpiPayment settings={upi} selection={selection} amount={pkg.price} summary={summary} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
      <div className="space-y-6">
        {/* ------------------------------------------------ Step 1: package */}
        <section className="card p-6 sm:p-8" aria-labelledby="choose-package">
          <p className="eyebrow">Step 1 · Your purchase</p>
          <h2 id="choose-package" className="mt-2 text-2xl">Choose Your Purchase</h2>
          <div role="radiogroup" aria-labelledby="choose-package" className="mt-5 grid gap-3 sm:grid-cols-3">
            {packages.map((p) => {
              const active = p.id === pkg.id;
              const saving = p.books * individualPrice - p.price;
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer flex-col rounded-xl border p-4 transition ${active ? "border-gold bg-cream ring-1 ring-gold" : "border-line bg-white hover:border-gold/60"}`}
                >
                  <span className="flex items-center gap-2">
                    <input type="radio" name="package" value={p.id} checked={active} onChange={() => choosePackage(p)} className="h-4 w-4 accent-[var(--color-ink)]" />
                    <span className="text-sm font-semibold">{p.label}</span>
                  </span>
                  <span className="mt-2 font-serif text-3xl">
                    <Price amount={p.price} originalPrice={p.originalPrice} currency={p.currency} />
                  </span>
                  <span className="mt-1 text-xs text-muted">
                    {p.books === 1 ? "Any 1 ebook" : p.books === books.length ? `All ${p.books} ebooks included` : `Any ${p.books} ebooks`}
                    {saving > 0 && <span className="font-semibold text-success"> · Save {formatMoney(saving, p.currency)}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        {/* ------------------------------------------------- Step 2: books */}
        <section className="card p-6 sm:p-8" aria-labelledby="choose-books">
          <p className="eyebrow">Step 2 · Your ebooks</p>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="choose-books" className="text-2xl">{heading}</h2>
            <p className={`text-sm font-semibold ${complete ? "text-success" : "text-muted"}`} aria-live="polite">
              {includesAll ? `${books.length} ebooks included` : `${selected.length}/${pkg.books} selected`}
            </p>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {books.map((b) => {
              const on = picked.includes(b.slug);
              const full = !on && !includesAll && pkg.books > 1 && picked.length >= pkg.books;
              const unavailable = !b.deliverable;
              return (
                <li key={b.slug}>
                  <label
                    className={`flex h-full items-center gap-4 rounded-xl border p-3 transition ${on ? "border-gold bg-cream ring-1 ring-gold" : "border-line bg-white"} ${
                      includesAll ? "" : full || unavailable ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-gold/60"
                    }`}
                  >
                    <input
                      type={pkg.books === 1 ? "radio" : "checkbox"}
                      name="books"
                      value={b.slug}
                      checked={on}
                      disabled={includesAll}
                      onChange={() => toggleBook(b.slug)}
                      className="sr-only"
                    />
                    <span className="w-12 shrink-0">{b.cover}</span>
                    <span className="min-w-0 flex-1">
                      {b.volumeLabel && <span className="eyebrow block">{b.volumeLabel}</span>}
                      <span className="block font-serif text-lg leading-snug">{b.title}</span>
                      <span className="block text-xs text-muted">by {b.author}</span>
                      {b.free && (
                        <span className="mt-1 inline-block rounded border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-gold-dark">
                          Free Book
                        </span>
                      )}
                      {unavailable && <span className="mt-1 block text-xs font-semibold text-gold-dark">{NOT_AVAILABLE}</span>}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${on ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
                    >
                      {on && <IconCheck width={14} height={14} />}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {(bookNotice || packageNotice) && (
            <p role="alert" className="mt-4 rounded-xl border border-gold/30 bg-cream px-4 py-3 text-sm text-ink/85">
              {bookNotice || packageNotice}
            </p>
          )}
        </section>

        {/* --------------------------------------------- Step 3: languages */}
        <section className="card p-6 sm:p-8" aria-labelledby="choose-langs">
          <p className="eyebrow">Step 3 · {multilingual ? "Languages" : "Language"}</p>
          <h2 id="choose-langs" className="mt-2 text-2xl">{!multilingual ? "Ebook language" : selected.length > 1 ? "Choose a language for each ebook" : "Choose your ebook language"}</h2>
          {!multilingual ? (
            <p className="mt-4 text-sm text-muted">All ebooks are currently provided in English, as PDF files.</p>
          ) : selected.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Select your {pkg.books === 1 ? "ebook" : "ebooks"} above first.</p>
          ) : (
            <>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {selected.map((b) => (
                  <LanguageSelector
                    key={b.slug}
                    bookSlug={b.slug}
                    value={lang(b.slug)}
                    onChange={(code) => onLanguage(b.slug, code)}
                    name={`language-${b.slug}`}
                    label={selected.length > 1 ? `${b.volumeLabel ?? b.title} — language` : undefined}
                    hint={false}
                  />
                ))}
              </div>
              <p className="mt-4 text-xs text-muted">Each ebook is provided as a PDF in the language you choose. Translated editions are machine-translated with Google Cloud Translation.</p>
            </>
          )}
        </section>
      </div>

      {/* ------------------------------------------------ Order summary */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <OrderSummary pkg={pkg} items={summaryItems}>
          {mode === "closed" && notice !== CLOSED && <p className="mt-4 rounded-xl border border-gold/30 bg-cream px-4 py-3 text-sm text-ink/85">{CLOSED}</p>}
          {notice && (
            <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              {notice}
            </p>
          )}
          {!user && !loading && (
            <p className="mt-4 rounded-xl border border-gold/40 bg-cream p-3 text-xs text-ink/80 flex items-center gap-2">
              <IconShield width={16} height={16} className="text-gold-dark shrink-0" />
              <span>You will be prompted to sign in to your account before completing payment.</span>
            </p>
          )}
          <button type="button" onClick={proceed} className={`btn-primary mt-5 w-full py-4 text-base ${canPay ? "" : "opacity-60"}`} aria-disabled={!canPay || undefined}>
            Proceed to Payment <IconArrowRight />
          </button>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <IconShield width={16} className="mt-px shrink-0 text-gold-dark" />
            The total is calculated securely on our server. Your ebooks are unlocked only after your payment is verified.
          </p>
        </OrderSummary>
      </div>
    </div>
  );
}

function OrderSummary({ pkg, items, children }: { pkg: PurchasePackage; items: { slug: string; title: string; language: string }[]; children?: React.ReactNode }) {
  return (
    <section className="card p-6" aria-labelledby="order-summary">
      <h2 id="order-summary" className="text-2xl">Order Summary</h2>
      <dl className="mt-4 text-sm">
        <dt className="text-muted">Package</dt>
        <dd className="font-medium">{pkg.name}</dd>
        <dt className="mt-3 text-muted">Ebooks</dt>
        <dd>
          {items.length === 0 ? (
            <span className="text-muted">None selected yet</span>
          ) : (
            <ul className="mt-1 space-y-2">
              {items.map((i) => (
                <li key={i.slug} className="flex justify-between gap-3">
                  <span className="font-medium">{i.title}</span>
                  <span className="shrink-0 text-muted">{i.language}</span>
                </li>
              ))}
            </ul>
          )}
        </dd>
        <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-line pt-4">
          <dt className="text-muted">Total</dt>
          <dd className="font-serif text-3xl">
            <Price amount={pkg.price} originalPrice={pkg.originalPrice} currency={pkg.currency} size="sm" align="end" />
          </dd>
        </div>
      </dl>
      <ChargedInInrNote inrAmount={pkg.price} className="mt-3" />
      {pkg.originalPrice ? <OfferCountdown className="mt-4" /> : null}
      {children}
    </section>
  );
}
