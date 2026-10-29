/**
 * ============================================================================
 *  SITE CONFIGURATION — edit this file to update the website.
 * ============================================================================
 *
 *  • Values written like "[SOMETHING]" are PLACEHOLDERS. Until you replace
 *    them, the related button/link is hidden on the live (production) site and
 *    listed under "Setup checklist" in the admin dashboard.
 *  • Tracking IDs left as "" (empty) simply switch that tracking script off.
 *  • Book descriptions, chapters and previews live in:  src/content/books.ts
 *  • Secrets (admin password, session secret) live in:  .env.local
 *
 *  After editing, restart the server (or redeploy) to see changes.
 * ============================================================================
 */

export const CONFIG = {
  // ---------------------------------------------------------------- Brand --
  SITE_NAME: "The Human Mind & Life Series",
  SERIES_NAME: "The Human Mind & Life Series",
  /**
   * Your live domain. Set NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN.com in the
   * server's environment (read at build time). Used for SEO, canonical URLs,
   * the sitemap, sharing images and email links.
   */
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://humanmind-lifeseries.com",
  /**
   * The person or business that sells the books (shown in the copyright line
   * and the legal pages). Replace with your legal / business name if you wish.
   */
  PUBLISHER_NAME: "The Human Mind & Life Series",

  // -------------------------------------------------------------- Authors --
  /** Pen names, one per volume. Shown exactly as written here. */
  AUTHOR_VOLUME_1: "Adrian Cole",
  AUTHOR_VOLUME_2: "Nathan Brooks",
  AUTHOR_VOLUME_3: "Elias Rowan",
  AUTHOR_VOLUME_4: "Julian Hayes",
  AUTHOR_VOLUME_5: "Maya Bennett",
  /** Pen name printed in "The Intimacy Code" (Volume 6). */
  AUTHOR_VOLUME_6: "S. K. Aria",

  // -------------------------------------------------------------- Contact --
  AUTHOR_EMAIL: "Saurabh933476@gmail.com",
  /** Optional separate address for business / bulk enquiries. "" = use AUTHOR_EMAIL. */
  BUSINESS_EMAIL: "",
  /** Country code + number, digits only. Example for India: "919876543210" */
  WHATSAPP_NUMBER: "919142786797",
  /** Shown in Terms & Conditions (jurisdiction), e.g. "Mumbai, Maharashtra". */
  BUSINESS_LOCATION: "[CITY, STATE]",

  // -------------------------------------------------------------- Payment --
  /** Your UPI ID. */
  UPI_ID: "saurabh933476-1@okhdfcbank",
  /** Name shown to buyers inside their UPI app. */
  UPI_PAYEE_NAME: "[UPI_PAYEE_NAME]",
  /**
   * Your EXACT UPI QR code image. Copy your original QR file (unedited) to
   *   public/images/upi-qr.png
   * It is shown at its original resolution — never regenerated, cropped or
   * recompressed. If you use a different file name/type (e.g. .jpg), change
   * this path to match.
   */
  UPI_QR_CODE: "/api/qr",
  /**
   * Shows a "Pay with a UPI app" button on phones (opens GPay/PhonePe/Paytm
   * with amount pre-filled). Some apps restrict such links for personal UPI
   * IDs. Off by default: buyers pay with your QR code / UPI ID only.
   */
  ENABLE_UPI_APP_BUTTON: false,

  // --------------------------------------------------------------- Prices --
  /**
   * Paid-book prices and bundles (Individual Ebook ₹299, shown as ₹599 → 50% OFF · any 3 books ₹649 ·
   * all 5 books ₹999) are set in ONE place: src/config/packages.ts.
   *
   * Volume 6 is FREE. A price of 0 automatically turns a book into a free
   * book: no payment page, no QR code, no UTR. Readers fill in a short
   * "Get Free Book" form instead.
   */
  BOOK_6_PRICE: 0,

  // --------------------------------------------------------------- Covers --
  /**
   * Book cover images. Put files in /public/images/covers/ and set the paths,
   * e.g. "/images/covers/volume-1.jpg". Leave "" to show the built-in
   * typographic cover design instead.
   */
  BOOK_COVER_1: "",
  BOOK_COVER_2: "",
  BOOK_COVER_3: "",
  BOOK_COVER_4: "",
  BOOK_COVER_5: "",
  BOOK_COVER_6: "/images/covers/volume-6.png",

  // ------------------------------------------------------------- Delivery --
  BOOK_FORMAT: "PDF eBook",
  /** Shown on the payment, thank-you and FAQ pages. Only promise what you can deliver. */
  DELIVERY_TIMEFRAME: "within 24 hours of payment verification",

  // ----------------------------------------------------- Free book (Vol 6) --
  /**
   * true  = after the "Get Free Book" form, the reader immediately gets a
   *         private, personal download link (only if the PDF exists at
   *         storage/books/volume-6.pdf). The link expires and can only be
   *         used a few times, so the PDF is never publicly accessible.
   * false = the request is saved as "FREE - PENDING DELIVERY" and you send
   *         the PDF yourself from the admin panel (Free Requests).
   */
  FREE_BOOK_INSTANT_DOWNLOAD: true,
  /** How long a personal download link works, in hours. */
  FREE_DOWNLOAD_LINK_HOURS: 48,
  /** How many times a personal download link can be used. */
  FREE_DOWNLOAD_LIMIT: 3,

  // ------------------------------------------------------ Ads & Analytics --
  // The three IDs below can also be set as environment variables (NEXT_PUBLIC_…), read at build time.
  /** Google Analytics 4 Measurement ID, e.g. "G-ABC123XYZ". "" = off. */
  GOOGLE_ANALYTICS_ID: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || "",
  /** Google Ads tag ID, e.g. "AW-123456789". "" = off. */
  GOOGLE_ADS_ID: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "",
  /**
   * Google Ads conversion label for "payment details submitted", e.g.
   * "AbC-D_efG-h12_34-567". Found in Google Ads → Goals → Conversions.
   */
  GOOGLE_ADS_LEAD_CONVERSION_LABEL: "",
  /** Optional separate Google Ads conversion label for free-book requests. */
  GOOGLE_ADS_FREE_BOOK_CONVERSION_LABEL: "",
  /** Meta (Facebook/Instagram) Pixel ID, e.g. "1234567890123456". "" = off. */
  META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
  /**
   * Payments are verified manually, so a submission is tracked as a LEAD by
   * default. Set true only if you also want submissions reported to Google /
   * Meta as a "Purchase" (useful for ad optimisation, but includes unverified
   * payments).
   */
  TRACK_SUBMISSION_AS_PURCHASE: false,

  // -------------------------------------------------------- Social Links --
  INSTAGRAM_URL: "[INSTAGRAM_URL]",
  FACEBOOK_URL: "[FACEBOOK_URL]",
  YOUTUBE_URL: "[YOUTUBE_URL]",
} as const;

/** True when a value is still an unfilled "[PLACEHOLDER]" or empty. */
export function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true;
  const v = value.trim();
  return v.startsWith("[") || v.startsWith("YOUR_");
}

/** A value is "shown" if configured, or always in development so you can preview layout. */
export function shouldShow(value: string): boolean {
  return !isPlaceholder(value) || process.env.NODE_ENV !== "production";
}

/** "your-domain.com/" → "https://your-domain.com" (no trailing slash; https added if missing). */
function normalizeSiteUrl(raw: string): string {
  const v = raw.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export const SITE_URL = normalizeSiteUrl(CONFIG.SITE_URL);
/** True while the live domain hasn't been set (example.com default or the YOUR-DOMAIN.com placeholder). */
export const SITE_URL_IS_PLACEHOLDER = /example\.com|your-domain/i.test(SITE_URL);
export const BUSINESS_EMAIL = CONFIG.BUSINESS_EMAIL || CONFIG.AUTHOR_EMAIL;
