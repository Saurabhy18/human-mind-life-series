/**
 * Ads & analytics event helpers (browser only).
 *
 * Funnel events sent (only for the tools whose IDs are set in site.config.ts):
 *   Book page viewed        → GA4 "view_item"        | Meta "ViewContent"
 *   Buy Now / payment page  → GA4 "begin_checkout"   | Meta "InitiateCheckout"
 *   Payment details sent    → GA4 "generate_lead"    | Meta "Lead"  | Google Ads lead conversion
 *                             (+ "purchase"/"Purchase" if TRACK_SUBMISSION_AS_PURCHASE is true)
 *   Free book requested     → GA4 "generate_lead" (lead_type free_book, value 0) | Meta "Lead" | Google Ads free-book conversion
 *   Contact form sent       → GA4 "contact"          | Meta "Contact"
 */
import { CONFIG } from "@/config/site.config";

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    fbq?: Fbq;
    dataLayer?: unknown[];
  }
}

export type TrackedProduct = { slug: string; label: string; price: number };

function gtag(...args: unknown[]) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") window.gtag(...args);
}
function fbq(...args: unknown[]) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") window.fbq(...args);
}

function item(p: TrackedProduct) {
  return { item_id: p.slug, item_name: p.label, item_brand: CONFIG.SITE_NAME, price: p.price, quantity: 1 };
}

export function trackViewItem(p: TrackedProduct) {
  gtag("event", "view_item", { currency: "INR", value: p.price, items: [item(p)] });
  fbq("track", "ViewContent", { content_ids: [p.slug], content_name: p.label, content_type: "product", value: p.price, currency: "INR" });
}

export function trackBeginCheckout(p: TrackedProduct) {
  gtag("event", "begin_checkout", { currency: "INR", value: p.price, items: [item(p)] });
  fbq("track", "InitiateCheckout", { content_ids: [p.slug], content_name: p.label, value: p.price, currency: "INR", num_items: 1 });
}

/** Fired once on the thank-you page after payment details are submitted. */
export function trackPaymentSubmitted(p: TrackedProduct, orderRef: string) {
  gtag("event", "generate_lead", { currency: "INR", value: p.price, transaction_id: orderRef, items: [item(p)] });
  fbq("track", "Lead", { content_ids: [p.slug], content_name: p.label, value: p.price, currency: "INR" }, { eventID: orderRef });

  if (CONFIG.GOOGLE_ADS_ID && CONFIG.GOOGLE_ADS_LEAD_CONVERSION_LABEL) {
    gtag("event", "conversion", {
      send_to: `${CONFIG.GOOGLE_ADS_ID}/${CONFIG.GOOGLE_ADS_LEAD_CONVERSION_LABEL}`,
      value: p.price,
      currency: "INR",
      transaction_id: orderRef,
    });
  }

  if (CONFIG.TRACK_SUBMISSION_AS_PURCHASE) {
    gtag("event", "purchase", { currency: "INR", value: p.price, transaction_id: orderRef, items: [item(p)] });
    fbq("track", "Purchase", { content_ids: [p.slug], content_type: "product", value: p.price, currency: "INR" }, { eventID: `p-${orderRef}` });
  }
}

/** Fired once when a FREE book is requested (no payment involved, value 0). */
export function trackFreeBookRequest(p: TrackedProduct, requestRef: string) {
  gtag("event", "generate_lead", { currency: "INR", value: 0, lead_type: "free_book", transaction_id: requestRef, items: [item(p)] });
  fbq("track", "Lead", { content_ids: [p.slug], content_name: p.label, content_category: "free_book", value: 0, currency: "INR" }, { eventID: requestRef });

  if (CONFIG.GOOGLE_ADS_ID && CONFIG.GOOGLE_ADS_FREE_BOOK_CONVERSION_LABEL) {
    gtag("event", "conversion", {
      send_to: `${CONFIG.GOOGLE_ADS_ID}/${CONFIG.GOOGLE_ADS_FREE_BOOK_CONVERSION_LABEL}`,
      value: 0,
      currency: "INR",
      transaction_id: requestRef,
    });
  }
}

export function trackContact() {
  gtag("event", "contact", { method: "contact_form" });
  fbq("track", "Contact");
}

export function trackWhatsAppClick(location: string) {
  gtag("event", "whatsapp_click", { location });
  fbq("trackCustom", "WhatsAppClick", { location });
}
