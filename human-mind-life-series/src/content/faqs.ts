import { CONFIG } from "@/config/site.config";
import { PACKAGES } from "@/config/packages";
import { FREE_BOOKS, PAID_BOOKS, bundleEnabled, bundlePrice, formatINR, individualTotal, volumeRange } from "@/lib/products";
import type { FaqItem } from "./books";
import type { CheckoutMode } from "@/lib/server/paymentService";

/**
 * General FAQs used on the FAQ page (all) and Home page (first few).
 * The payment questions follow the configured checkout: the manual UPI steps (and our UPI ID) appear only
 * when PAYMENT_PROVIDER=manual_upi; otherwise the online checkout — or, while closed, that it isn't open yet.
 */
export function getGeneralFaqs(mode: CheckoutMode): FaqItem[] {
  const three = PACKAGES.three_book_bundle;
  const bundleAnswer = bundleEnabled()
    ? `Yes. You can buy all ${PAID_BOOKS.length} paid volumes together for ${formatINR(bundlePrice())} (compared with ${formatINR(individualTotal())} when bought individually), or choose any ${three.books} books for ${formatINR(three.price)}. Choose your package on the payment page.`
    : "A complete-series offer is not available at the moment. Follow us on social media or contact us to hear about future offers.";

  const freeFaqs: FaqItem[] = FREE_BOOKS.flatMap((b) => [
    {
      q: `Is ${b.title} really free?`,
      a: `Yes. ${b.title} by ${b.author} is completely free. Click “GET FREE BOOK” on its page and enter your name and email address (WhatsApp is optional). There is no payment, no QR code, no UTR and no screenshot.`,
    },
    {
      q: "Which books are paid and which are free?",
      a: `${volumeRange(PAID_BOOKS)} are paid books${mode === "upi" ? ", bought with UPI" : ""}. ${b.title} is free.`,
    },
  ]);

  return [
    ...freeFaqs,
    ...purchaseFaqs(mode),
    {
      q: "Is the book available as PDF?",
      a: `Yes. The books are delivered as a ${CONFIG.BOOK_FORMAT}, which you can read on a phone, tablet or computer. Your copy is for your personal use only.`,
    },
    {
      q: "Can I purchase multiple volumes?",
      a: `Yes. On the payment page choose “Choose Any ${PACKAGES.three_book_bundle.books} Books” (${formatINR(PACKAGES.three_book_bundle.price)}) or the “Complete ${PACKAGES.five_book_bundle.books} Book Bundle” (${formatINR(PACKAGES.five_book_bundle.price)}), select your books and a language for each, and pay once for the whole order.`,
    },
    {
      q: "Is there a complete-series offer?",
      a: bundleAnswer,
    },
    {
      q: "Do you ask for my UPI PIN or bank details?",
      a: "Never. We will never ask for your UPI PIN, OTP, bank password, card number or CVV. Please never share these with anyone, including people claiming to be from us.",
    },
    {
      q: mode === "upi" ? "What if I made a mistake in my submission?" : "What if I made a mistake in my order?",
      a: "Contact us by email or WhatsApp with your order reference and the correct details, and we will help you.",
    },
  ];
}

function purchaseFaqs(mode: CheckoutMode): FaqItem[] {
  if (mode === "upi") {
    return [
      {
        q: "How do I purchase a book?",
        a: "Choose a book on the Books page and click “Buy Now”. You will be taken to the payment page, where you pay by scanning our UPI QR code and then submit your payment details. Once we verify your payment, we send your book to you.",
      },
      {
        q: "How do I pay using UPI?",
        a: `We accept payment by UPI only. Scan the QR code on the payment page with any UPI app (or pay to our UPI ID, ${CONFIG.UPI_ID}), pay the exact amount shown, and then submit your payment details using the form on the same page.`,
      },
      {
        q: "Which UPI apps can I use?",
        a: "You can use any UPI app that supports scanning a QR code or paying to a UPI ID — for example Google Pay, PhonePe, Paytm, BHIM or your bank’s own UPI app.",
      },
      {
        q: "Where do I enter my UTR number?",
        a: "After paying, scroll to the “Payment completed?” form on the payment page and enter your UTR / Transaction ID in the field provided. You can find the UTR (usually a 12-digit number) in your UPI app’s payment history or transaction details.",
      },
      {
        q: "Why do I need to upload a payment screenshot?",
        a: "Payments are verified manually. Your screenshot, together with your UTR / Transaction ID and the amount paid, helps us quickly find and match your payment in our UPI account. Your screenshot is stored privately and is only seen by us for verification.",
      },
      {
        q: "How long does payment verification take?",
        a: `We check every payment by hand, so verification is not instant. Once verified, your book is sent ${CONFIG.DELIVERY_TIMEFRAME}. If you have not heard from us, contact us with your order reference.`,
      },
      {
        q: "When will I receive my book?",
        a: `Every payment is verified manually. Once your payment is verified, your book is sent to the email address and/or WhatsApp number you provide, ${CONFIG.DELIVERY_TIMEFRAME}.`,
      },
      {
        q: "Is my payment automatically confirmed?",
        a: "No. Every payment is checked manually against our UPI account before your book is delivered. You will hear from us once your payment has been verified.",
      },
    ];
  }
  if (mode === "closed") {
    return [
      {
        q: "How do I purchase a book?",
        a: "Online checkout is not open yet, so books can’t be bought on this website at the moment. You can browse every book, read the previews and see the prices. If you have a question, please contact us.",
      },
    ];
  }
  return [
    {
      q: "How do I purchase a book?",
      a: "Choose a book and click “Buy Now”, or choose a bundle of 3 or 5 books. Review your order summary, then pay on the secure checkout page. As soon as the payment gateway confirms your payment to us, your ebooks can be downloaded from your private order page.",
    },
    {
      q: "How do I pay?",
      a: "On the secure checkout page of our payment gateway, using one of the payment methods it shows you. We never see or store your card number, CVV, UPI PIN or bank password.",
    },
    {
      q: "Is my payment automatically confirmed?",
      a: "Yes. Our server checks every payment directly with the payment gateway before your ebooks are unlocked — never just from the page you return to after paying.",
    },
    {
      q: "When will I receive my book?",
      a: `Once your payment is confirmed, your ebooks can be downloaded from your private order page ${CONFIG.DELIVERY_TIMEFRAME}.`,
    },
  ];
}
