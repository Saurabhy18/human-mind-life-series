import { CONFIG } from "@/config/site.config";
import type { CheckoutMode } from "@/lib/server/paymentService";

/**
 * Short payment wording used around the site, matched to the configured checkout
 * (lib/server/paymentService.ts → checkoutMode()):
 *   upi             → the original manual UPI QR wording (only when PAYMENT_PROVIDER=manual_upi)
 *   gateway, closed → online-payment wording. While checkout is closed, the checkout page itself
 *                     says that no payment can be made yet.
 * Static pages pick this up at build time, so rebuild after changing PAYMENT_PROVIDER.
 */
export function paymentCopy(mode: CheckoutMode) {
  const upi = mode === "upi";
  return {
    payShort: upi ? "Pay by UPI" : "Secure online payment",
    payDetail: upi ? "Scan our QR code with any UPI app." : "Pay on a secure checkout page.",
    confirmedShort: upi ? "Verified by us" : "Confirmed before delivery",
    confirmedDetail: upi ? "Every payment is personally checked before delivery." : "Your ebooks are unlocked only after your payment is confirmed.",
    trustPay: upi ? "Simple UPI QR payment" : "Secure online payment",
    trustDelivery: upi ? "Personally verified delivery" : "Unlocked after payment is confirmed",
    bulletPay: upi ? "Pay securely with any UPI app" : "Secure online payment",
    bulletConfirmed: upi ? "Payment personally verified" : "Unlocked after payment is confirmed",
    landingConfirmed: upi ? "Every payment personally verified" : "Ebooks unlocked after payment is confirmed",
    footer: upi ? "Secure UPI payments" : "Secure online payments",
    homeCta: upi
      ? "Choose a volume, pay securely by UPI, and receive your book once your payment is verified."
      : "Choose a volume, pay securely online, and get your ebook once your payment is confirmed.",
    bookCta: upi ? "Pay by UPI and receive your book once your payment is verified." : "Pay securely online and get your ebook once your payment is confirmed.",
    howToBuy: upi
      ? [
          { title: "Click “Buy Now”", text: "Choose your book and go to the secure payment page." },
          { title: "Scan & pay by UPI", text: "Use Google Pay, PhonePe, Paytm, BHIM or any UPI app." },
          { title: "Submit your details", text: "Enter your UTR / Transaction ID and upload a payment screenshot." },
          { title: "Receive your book", text: `After verification, your ${CONFIG.BOOK_FORMAT} is sent to your email / WhatsApp.` },
        ]
      : [
          { title: "Click “Buy Now”", text: "Choose one ebook, any 3 or all 5, and go to checkout." },
          { title: "Review your order", text: "Check your ebooks and the total in the order summary." },
          { title: "Pay securely online", text: "Complete the payment on the secure checkout page." },
          { title: "Download your ebook", text: `Once your payment is confirmed, download your ${CONFIG.BOOK_FORMAT} from your private order page.` },
        ],
  };
}
