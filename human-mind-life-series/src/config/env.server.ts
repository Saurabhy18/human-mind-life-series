import "server-only";
import { SITE_URL } from "./site.config";

/**
 * SERVER-ONLY SETTINGS (translation, payments, storage, email).
 * Everything here comes from environment variables (.env.local on your
 * computer, or the host's environment in production). Never import this file
 * from a client component — secrets must never reach the browser.
 */

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v.trim();
}
function int(name: string, fallback: number, min = 0): number {
  const n = Number.parseInt(str(name), 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}
function bool(name: string, fallback: boolean): boolean {
  const v = str(name).toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

const isProd = process.env.NODE_ENV === "production";
const projectId = str("GOOGLE_CLOUD_PROJECT_ID");

export type TranslationProvider = "google" | "fake" | "none";
export type TranslationStrategy = "document" | "text";
/** none = checkout closed (no payments taken). cashfree = gateway checkout. manual_upi = the older UPI QR + admin verification flow (opt-in only). */
export type PaymentProvider = "none" | "manual_upi" | "cashfree";

function paymentProvider(): PaymentProvider {
  const v = str("PAYMENT_PROVIDER", "manual_upi");
  return v === "cashfree" || v === "manual_upi" ? v : "manual_upi";
}


function translationProvider(): TranslationProvider {
  const v = str("TRANSLATION_PROVIDER", projectId ? "google" : "none");
  // The fake translator only exists for local testing and can NEVER run in production (no override).
  if (v === "fake") return isProd ? "none" : "fake";
  return v === "google" && projectId ? "google" : "none";
}

const supabaseDbConfigured = !!str("SUPABASE_DATABASE_URL");
const databaseDriverName = str("DB_DRIVER");
const resolvedDatabaseDriver = databaseDriverName
  ? (databaseDriverName.toLowerCase() === "supabase" ? "supabase" : "sqlite")
  : supabaseDbConfigured
    ? "supabase"
    : "sqlite";

const storageDriverName = str("STORAGE_DRIVER", "").toLowerCase();
const storageBucketName = str("SUPABASE_STORAGE_BUCKET", str("BOOK_STORAGE_BUCKET", "site-files"));
const resolvedStorageDriver =
  storageDriverName === "supabase"
    ? "supabase"
    : storageDriverName === "gcs"
      ? "gcs"
      : storageDriverName === "local"
        ? "local"
        : !!str("SUPABASE_STORAGE_BUCKET")
          ? "supabase"
          : str("BOOK_STORAGE_BUCKET")
            ? "gcs"
            : "local";

export const ENV = {
  isProd,
  frontendUrl: str("FRONTEND_URL", SITE_URL).replace(/\/$/, ""),

  database: {
    driver: resolvedDatabaseDriver as "sqlite" | "supabase",
    ready: resolvedDatabaseDriver === "supabase" || !!str("SUPABASE_DATABASE_URL"),
  },

  supabase: {
    url: str("NEXT_PUBLIC_SUPABASE_URL", str("SUPABASE_URL")),
    anonKey: str("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", str("SUPABASE_ANON_KEY")),
    serviceRoleKey: str("SUPABASE_SERVICE_ROLE_KEY"),
    databaseUrl: str("SUPABASE_DATABASE_URL"),
    ready: !!str("NEXT_PUBLIC_SUPABASE_URL", str("SUPABASE_URL")) && !!str("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", str("SUPABASE_ANON_KEY")),
  },

  // ---------------------------------------------------------- Translation --
  translation: {
    provider: translationProvider(),
    projectId,
    location: str("GOOGLE_CLOUD_LOCATION", "global"),
    /** "document" = Google Document Translation (keeps the original PDF layout). "text" = extract → translate → rebuild. */
    strategy: (str("TRANSLATION_STRATEGY", "document") === "text" ? "text" : "document") as TranslationStrategy,
    /** Pages per translateDocument request (Google allows up to 300 for native PDFs, 20 MB per request). */
    docPagesPerRequest: Math.min(int("DOC_TRANSLATION_PAGES_PER_REQUEST", 100, 1), 300),
    /** Max characters (code points) per translateText request. Google recommends ≤ 5,000; hard limit 30,000. */
    textCharsPerRequest: Math.min(int("TEXT_TRANSLATION_CHARS_PER_REQUEST", 5000, 500), 30000),
    maxAttempts: int("TRANSLATION_MAX_ATTEMPTS", 3, 1),
    retryBaseSeconds: int("TRANSLATION_RETRY_BASE_SECONDS", 30, 1),
    languagesCacheHours: int("LANGUAGES_CACHE_HOURS", 24, 1),
    /** USD prices used only for the cost estimate shown in the admin panel. */
    pricePerMillionCharsUsd: Number(str("TRANSLATION_PRICE_PER_MILLION_CHARS_USD", "20")),
    pricePerPageUsd: Number(str("DOCUMENT_TRANSLATION_PRICE_PER_PAGE_USD", "0.08")),
    chromiumPath: str("CHROMIUM_PATH"),
    /**
     * Translated editions are offered to customers ONLY when this is true. Set it after Google is configured
     * AND a real translation has been produced, checked and downloaded end to end. Until then: English only.
     */
    salesEnabled: bool("TRANSLATION_SALES_ENABLED", false),
  },

  // ------------------------------------------------------------- Payments --
  // Default "none": the site takes no payments until a provider is deliberately configured.
  payment: (() => {
    // Live Cashfree is used ONLY when NODE_ENV=production AND CASHFREE_ENV=production.
    // Everywhere else (local, preview, tests) we are pinned to sandbox, so no real money can move.
    const cashfreeEnv: "sandbox" | "production" =
      str("CASHFREE_ENV", isProd ? "production" : "sandbox").toLowerCase() === "production" && isProd ? "production" : "sandbox";
    const defaultApiBase = cashfreeEnv === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
    return {
      provider: paymentProvider(),
      cashfreeEnv,
      cashfreeClientId: str("CASHFREE_CLIENT_ID"),
      cashfreeSecretKey: str("CASHFREE_SECRET_KEY"),
      cashfreeApiVersion: str("CASHFREE_API_VERSION", "2023-08-01"),
      // Overridable only outside production (tests use a local mock); production always talks to Cashfree itself.
      cashfreeApiBase: isProd ? defaultApiBase : str("CASHFREE_API_BASE", defaultApiBase),
    };
  })(),

  // ---------------------------------------------------- Storage & download --
  storage: {
    driver: resolvedStorageDriver as "local" | "gcs" | "supabase",
    bucket: storageBucketName,
  },
  download: {
    /** Lifetime of each signed download URL, in seconds. */
    urlTtlSeconds: int("DOWNLOAD_URL_TTL_SECONDS", 600, 30),
    /** How long the customer's personal order link keeps working after the book is ready. */
    accessHours: int("DOWNLOAD_ACCESS_HOURS", 48, 1),
    maxDownloads: int("MAX_DOWNLOADS_PER_ORDER", 5, 1),
    signingSecret: str("DOWNLOAD_SIGNING_SECRET", str("SESSION_SECRET")),
  },

  // ---------------------------------------------------------------- Email --
  email: {
    smtpHost: str("SMTP_HOST"),
    smtpPort: int("SMTP_PORT", 587, 1),
    smtpSecure: bool("SMTP_SECURE", false),
    smtpUser: str("SMTP_USER"),
    smtpPass: str("SMTP_PASS"),
    from: str("EMAIL_FROM"),
    /** Test only: "json" captures emails instead of sending them. */
    transport: str("EMAIL_TRANSPORT"),
  },

  worker: {
    pollSeconds: int("WORKER_POLL_SECONDS", 3, 1),
    leaseMinutes: int("WORKER_LEASE_MINUTES", 30, 1),
  },
};

export function translationEnabled(): boolean {
  return ENV.translation.provider !== "none";
}

/** Translated editions are sold only when a translator is configured AND the owner has switched sales on (TRANSLATION_SALES_ENABLED). */
export function translationOffered(): boolean {
  return translationEnabled() && ENV.translation.salesEnabled;
}
