import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS_EMAIL, CONFIG } from "@/config/site.config";
import { pageMetadata } from "@/lib/seo";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = pageMetadata({
  title: "Refund & Cancellation Policy",
  description: "Refund and cancellation policy for digital books purchased from The Human Mind & Life Series.",
  path: "/refund-policy",
});

/** Number of days customers have to report a problem. Change if needed. */
const REPORT_WINDOW_DAYS = 7;

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      intro="Because our books are digital products delivered electronically, the following policy applies to all purchases."
    >
      <h2>1. Digital products</h2>
      <p>
        All books sold on this website are digital {CONFIG.BOOK_FORMAT}s. Once a book has been delivered to you, it cannot be “returned”. For this reason,
        <strong> all sales are final once the book has been delivered</strong>, except in the situations described below.
      </p>

      <p>
        Books offered free of charge (such as The Intimacy Code) involve no payment, so there is nothing to refund or cancel. If you have a problem receiving a
        free book, please contact us and we will help.
      </p>

      <h2>2. When you are eligible for a refund</h2>
      <ul>
        <li>
          <strong>Payment rejected or not delivered:</strong> if we receive your payment but cannot deliver your book (for example, because the book is
          unavailable), we will refund the full amount.
        </li>
        <li>
          <strong>Duplicate payment:</strong> if you accidentally pay twice for the same book, we will refund the duplicate payment after verification.
        </li>
        <li>
          <strong>Incorrect amount:</strong> if you pay more than the listed price, we will refund the difference. If you pay less, we will contact you to
          either pay the balance or receive a refund of the amount paid.
        </li>
        <li>
          <strong>Wrong or faulty file:</strong> if you receive the wrong book or a file that cannot be opened, please tell us within {REPORT_WINDOW_DAYS}{" "}
          days of delivery. We will first send you the correct or a working file; if we cannot, we will refund you.
        </li>
      </ul>

      <h2>3. When refunds are not available</h2>
      <ul>
        <li>After the correct book has been delivered and can be opened.</li>
        <li>If you change your mind after delivery, or bought the wrong volume by mistake after it has been delivered.</li>
        <li>If you provided an incorrect email address or WhatsApp number and the book was delivered to those details.</li>
      </ul>

      <h2>4. Cancellations</h2>
      <p>
        You may cancel your order at any time <strong>before</strong> your book has been delivered by contacting us with your order reference. If your
        payment has already been received, we will refund it in full. Orders cannot be cancelled after delivery.
      </p>

      <h2>5. Rejected payments</h2>
      <p>
        If we cannot find your payment, the details do not match, or the submission appears to be fraudulent, your submission will be marked as “Payment
        Rejected” and no book will be delivered. If you believe this is a mistake, contact us with your UTR / Transaction ID and payment screenshot and we
        will review it again.
      </p>

      <h2>6. How to request a refund or cancellation</h2>
      <p>
        Email us at <strong>{BUSINESS_EMAIL}</strong>
        {!CONFIG.WHATSAPP_NUMBER.startsWith("[") && <> or message us on WhatsApp at <strong>+{CONFIG.WHATSAPP_NUMBER}</strong></>} with your order
        reference, the UTR / Transaction ID and the reason for your request.
      </p>

      <h2>7. How refunds are paid</h2>
      <p>
        Approved refunds are sent back to the UPI ID or bank account the payment came from, normally within 5–7 working days of approval. The time it
        takes to appear in your account may depend on your bank.
      </p>

      <p className="mt-10">
        See also our <Link href="/terms-and-conditions">Terms &amp; Conditions</Link> and <Link href="/privacy-policy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
