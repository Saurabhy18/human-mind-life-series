"use client";

import { CONFIG } from "@/config/site.config";
import { formatMoney, type PurchaseSelection } from "@/config/packages";
import { upiPayLink } from "@/lib/contact";
import { IconPhone, IconShield, IconWhatsApp } from "../icons";
import { CopyButton } from "./CopyButton";
import { PaymentForm } from "./PaymentForm";

export type UpiSettings = {
  upiId: string;
  upiConfigured: boolean;
  /** The QR image (or its placeholder), rendered on the server. */
  qr: React.ReactNode;
  /** WhatsApp help link, if configured. */
  help: string | null;
};

/** UPI QR payment for the chosen package, then the "Payment completed?" form (verified manually by the admin). */
export function UpiPayment({ settings, selection, amount, summary }: { settings: UpiSettings; selection: PurchaseSelection; amount: number; summary: string }) {
  const { upiId, upiConfigured, qr, help } = settings;
  const payLink = CONFIG.ENABLE_UPI_APP_BUTTON ? upiPayLink(amount, summary) : null;
  const price = formatMoney(amount, "INR");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
      {/* ---------------------------------------------- Pay */}
      <section aria-labelledby="pay" className="space-y-6">
        <div className="card p-6 text-center sm:p-8">
          <p className="eyebrow">Step 4 · Pay by UPI</p>
          <h2 id="pay" className="mt-2 text-2xl">Scan the QR code below using any supported UPI app.</h2>

          <div className="mx-auto mt-6 w-full max-w-[340px]">{qr}</div>

          <p className="mt-6 text-sm text-muted">Amount to pay</p>
          <p className="font-serif text-4xl">{price}</p>

          <div className="mx-auto mt-5 flex max-w-sm items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3 text-left">
            <div className="min-w-0">
              <p className="text-xs text-muted">UPI ID:</p>
              <p className="font-mono text-sm font-semibold break-all">{upiId}</p>
            </div>
            {upiConfigured && <CopyButton value={upiId} />}
          </div>

          {payLink && (
            <a href={payLink} className="btn-gold mt-5 w-full max-w-sm py-4 text-base md:hidden">
              <IconPhone /> Pay {price} with a UPI app
            </a>
          )}

          <p className="mt-6 text-xs text-muted">Google Pay · PhonePe · Paytm · BHIM · any bank UPI app</p>
        </div>

        <ol className="space-y-3 text-sm text-ink/80">
          {[
            `Pay exactly ${price} by scanning the QR code or paying to the UPI ID.`,
            "Note the UTR / Transaction ID shown in your UPI app and take a screenshot.",
            "Fill in the “Payment completed?” form and submit.",
            `We verify your payment and deliver your ${selection.items.length > 1 ? "ebooks" : "ebook"} ${CONFIG.DELIVERY_TIMEFRAME}.`,
          ].map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------- Submit details */}
      <section aria-labelledby="details" className="card h-fit p-6 sm:p-8 lg:sticky lg:top-28">
        <p className="eyebrow">Step 5 · Confirm your payment</p>
        <h2 id="details" className="mt-2 text-3xl">Payment completed?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">After completing your payment, enter your transaction details below.</p>

        <div className="mt-5 flex gap-3 rounded-xl border border-gold/30 bg-cream px-4 py-3 text-sm text-ink/85">
          <IconShield className="mt-0.5 shrink-0 text-gold-dark" />
          <p>
            <strong>Your payment will be manually verified before your ebooks are delivered.</strong> Payments are never confirmed automatically. We will never ask for your UPI PIN, OTP or bank password.
          </p>
        </div>

        <div className="mt-6">
          <PaymentForm selection={selection} amount={amount} summary={summary} upiId={upiId} />
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
  );
}
