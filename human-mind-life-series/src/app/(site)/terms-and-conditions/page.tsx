import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS_EMAIL, CONFIG } from "@/config/site.config";
import { pageMetadata } from "@/lib/seo";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = pageMetadata({
  title: "Terms & Conditions",
  description: "Terms and conditions for buying and using books from The Human Mind & Life Series.",
  path: "/terms-and-conditions",
});

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" intro="Please read these terms carefully before purchasing or using any book from this website.">
      <p>
        These Terms &amp; Conditions (“Terms”) govern your use of this website and your purchase of books from {CONFIG.SITE_NAME}, operated by{" "}
        {CONFIG.PUBLISHER_NAME} (“we”, “us”, “our”). By using this website or placing an order, you agree to these Terms.
      </p>

      <h2>1. Products</h2>
      <p>
        We sell digital books ({CONFIG.BOOK_FORMAT}s). No physical product is shipped. Each volume is sold as a separate product unless a combined offer
        is clearly stated on the website. Book descriptions are provided to help you choose; we make reasonable efforts to keep them accurate.
      </p>

      <h3>Free books</h3>
      <p>
        Some books (such as The Intimacy Code) are offered free of charge. To receive a free book you submit your name and email address (WhatsApp is
        optional). No payment, QR code, UTR or payment screenshot is required. Free books are provided for personal use under the same licence terms
        as paid books, and we may withdraw a free offer at any time. Any personal download link we provide is for you alone, expires after a limited
        time and may be used only a limited number of times.
      </p>

      <h2>2. Prices</h2>
      <p>
        All prices are shown in Indian Rupees (₹). The price payable is the price displayed on the payment page at the time of your purchase. We may
        change prices at any time, but changes will not affect orders already submitted.
      </p>

      <h2>3. Ordering and payment</h2>
      <ul>
        <li>For paid books, payment is accepted only by UPI, using the QR code or UPI ID displayed on our payment page.</li>
        <li>You must pay the exact amount shown for the book you are purchasing.</li>
        <li>
          After paying, you must submit your name, email address, WhatsApp number, the book purchased, your UTR / Transaction ID and a screenshot of the
          payment using the form provided.
        </li>
        <li>
          Submitting the form does not confirm your order. Every payment is <strong>verified manually</strong> against our records. Your order is
          confirmed only when your payment has been verified.
        </li>
        <li>
          We may reject a submission if the payment cannot be found, the amount is incorrect, the UTR has already been used, or the details appear false
          or fraudulent.
        </li>
        <li>We will never ask for your UPI PIN, OTP, bank password or card details.</li>
      </ul>

      <h2>4. Delivery</h2>
      <p>
        After your payment is verified, your book will be sent to the email address and/or WhatsApp number you provided, {CONFIG.DELIVERY_TIMEFRAME}.
        Please make sure your contact details are correct. We are not responsible for delays caused by incorrect details, full mailboxes, spam filters or
        blocked WhatsApp messages; if you have not received your book, please contact us.
      </p>

      <h2>5. Licence and permitted use</h2>
      <p>
        When you buy a book, you receive a personal, non-exclusive, non-transferable licence to read it for your own private, non-commercial use. All
        content is protected by copyright and remains the property of {CONFIG.PUBLISHER_NAME}. You may not copy, share, resell, upload, distribute,
        publicly display or otherwise make the book available to anyone else, in whole or in part, without our written permission.
        Unauthorised distribution may result in legal action.
      </p>

      <h2>6. Content disclaimer</h2>
      <p>
        The books are written for general information, education and personal development. They are not a substitute for professional medical,
        psychological, psychiatric, legal or financial advice. Always seek the advice of a qualified professional regarding any condition or decision.
        Volume 5 (“A Healthy Sex Life at Any Age”) is intended only for adults aged 18 and above. You use the information in the books at your own
        discretion and risk.
      </p>

      <h2>7. Refunds and cancellations</h2>
      <p>
        Refunds and cancellations are governed by our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.
      </p>

      <h2>8. Acceptable use of the website</h2>
      <p>
        You agree not to submit false information, attempt to access other customers’ information or the admin area, upload harmful files, interfere with
        the website’s operation, or use the website for any unlawful purpose.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, our total liability arising from any purchase is limited to the amount you paid for the relevant book. We
        are not liable for any indirect or consequential loss.
      </p>

      <h2>10. Privacy</h2>
      <p>
        Your personal information is handled in accordance with our <Link href="/privacy-policy">Privacy Policy</Link>.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These Terms are governed by the laws of India. Any dispute shall be subject to the exclusive jurisdiction of the courts at {CONFIG.BUSINESS_LOCATION}.
      </p>

      <h2>12. Changes</h2>
      <p>We may update these Terms from time to time. The version published on this page at the time of your purchase applies to that purchase.</p>

      <h2>13. Contact</h2>
      <p>
        Questions about these Terms can be sent to <strong>{BUSINESS_EMAIL}</strong> or through our <Link href="/contact">contact page</Link>.
      </p>
    </LegalPage>
  );
}
