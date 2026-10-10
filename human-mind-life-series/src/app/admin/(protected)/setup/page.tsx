import fs from "node:fs";
import path from "node:path";
import { CONFIG, SITE_URL, SITE_URL_IS_PLACEHOLDER, isPlaceholder } from "@/config/site.config";
import { requireAdmin } from "@/lib/server/auth";
import { PRIVATE_BOOKS_DIR, storageStatus } from "@/lib/server/db";
import { upiQrAvailable } from "@/lib/server/qr";
import { checkoutMode } from "@/lib/server/paymentService";
import { bookDeliverable } from "@/lib/server/translation/bookSource";
import { ALL_BOOKS, FREE_BOOKS, getAllProducts } from "@/lib/products";
import { SERIES } from "@/content/books";

type Check = { key: string; ok: boolean; hint: string };

export default async function AdminSetupPage() {
  await requireAdmin();
  const mode = checkoutMode();
  const storage = storageStatus();

  const checks: Check[] = [
    {
      key: "Checkout (PAYMENT_PROVIDER)",
      ok: mode !== "closed",
      hint:
        mode === "gateway"
          ? "Razorpay checkout is on."
          : mode === "upi"
            ? "Manual UPI checkout is on (PAYMENT_PROVIDER=manual_upi)."
            : "Closed — no orders or payments are accepted. After Razorpay approves your account, set PAYMENT_PROVIDER=razorpay and the Razorpay keys on the server (README §9.3), then rebuild.",
    },
    {
      key: "Private storage (STORAGE_DIR)",
      ok: storage.writable && !storage.ephemeral,
      hint: !storage.writable
        ? `Not writable: ${storage.dir}. Fix the folder permissions or set STORAGE_DIR.`
        : storage.ephemeral
          ? `${storage.dir} is inside a build/deployment or public folder — data would be lost or exposed. Set STORAGE_DIR to a persistent private folder.`
          : `${storage.dir} — orders.db, payment screenshots and book PDFs live here.`,
    },
    { key: "SITE_URL", ok: !SITE_URL_IS_PLACEHOLDER, hint: "Your live domain: set NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN.com on the server and rebuild (needed for SEO, sitemap and sharing)." },
    { key: "AUTHOR_EMAIL", ok: !isPlaceholder(CONFIG.AUTHOR_EMAIL), hint: "Contact email." },
    { key: "WHATSAPP_NUMBER", ok: !isPlaceholder(CONFIG.WHATSAPP_NUMBER), hint: "Digits with country code, e.g. 919876543210." },
    { key: "BUSINESS_LOCATION", ok: !isPlaceholder(CONFIG.BUSINESS_LOCATION), hint: "City/state for the Terms & Conditions." },
    // The UPI details matter only for the opt-in manual UPI checkout.
    ...(mode === "upi"
      ? [
          { key: "UPI_ID", ok: !isPlaceholder(CONFIG.UPI_ID), hint: "Your UPI ID." },
          { key: "UPI_PAYEE_NAME", ok: !isPlaceholder(CONFIG.UPI_PAYEE_NAME), hint: "Name shown in UPI apps." },
          { key: "UPI_QR_CODE", ok: upiQrAvailable(), hint: `Copy your original, unedited QR image to public${CONFIG.UPI_QR_CODE || "/images/upi-qr.png"}.` },
        ]
      : []),
    ...ALL_BOOKS.map((b) => ({
      key: `BOOK_COVER_${b.volume}`,
      ok: !!b.cover,
      hint: `Cover for Volume ${b.volume} (built-in design is shown until set).`,
    })),
    { key: "Volume 4 title & content", ok: !ALL_BOOKS[3].title.startsWith("["), hint: "Edit src/content/books.ts." },
    { key: "Series mission", ok: !SERIES.mission.startsWith("["), hint: "Edit SERIES.mission in src/content/books.ts." },
    { key: "GOOGLE_ANALYTICS_ID", ok: !!CONFIG.GOOGLE_ANALYTICS_ID, hint: "Optional — GA4 measurement ID (G-…)." },
    { key: "GOOGLE_ADS_ID", ok: !!CONFIG.GOOGLE_ADS_ID, hint: "Optional — Google Ads tag (AW-…)." },
    { key: "GOOGLE_ADS_LEAD_CONVERSION_LABEL", ok: !!CONFIG.GOOGLE_ADS_LEAD_CONVERSION_LABEL, hint: "Optional — conversion label for submissions." },
    { key: "META_PIXEL_ID", ok: !!CONFIG.META_PIXEL_ID, hint: "Optional — Meta Pixel ID." },
    { key: "INSTAGRAM_URL", ok: !isPlaceholder(CONFIG.INSTAGRAM_URL), hint: "Hidden on the live site until set." },
    { key: "FACEBOOK_URL", ok: !isPlaceholder(CONFIG.FACEBOOK_URL), hint: "Hidden on the live site until set." },
    { key: "YOUTUBE_URL", ok: !isPlaceholder(CONFIG.YOUTUBE_URL), hint: "Hidden on the live site until set." },
  ];

  // Paid books can be ordered only when their PDF is present AND opens as a valid PDF.
  const pdfs = [
    ...(await Promise.all(getAllProducts().map(async (p) => ({ slug: p.slug, label: p.label, ok: await bookDeliverable(p.slug) })))),
    ...FREE_BOOKS.map((b) => ({ slug: b.slug, label: `${b.label} (FREE)`, ok: fs.existsSync(path.join(/*turbopackIgnore: true*/ PRIVATE_BOOKS_DIR, `${b.slug}.pdf`)) })),
  ];
  const done = checks.filter((c) => c.ok).length;

  return (
    <>
      <h1 className="text-3xl">Setup &amp; Ads</h1>
      <p className="mt-1 text-sm text-muted">
        Edit values in <code>src/config/site.config.ts</code> and book content in <code>src/content/books.ts</code>, then redeploy.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-xl">Setup checklist <span className="text-base text-muted">({done}/{checks.length})</span></h2>
          <ul className="mt-4 divide-y divide-line text-sm">
            {checks.map((c) => (
              <li key={c.key} className="flex items-start gap-3 py-2.5">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${c.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                  {c.ok ? "✓" : "!"}
                </span>
                <div>
                  <p className="font-mono text-xs font-semibold">{c.key}</p>
                  <p className="text-muted">{c.hint}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-xl">Database backup</h2>
            <p className="mt-1 text-sm text-muted">
              Downloads a complete, consistent copy of <code>orders.db</code> (orders, free requests, messages). Take one before every deployment and regularly — your host&apos;s
              backups may not include the private storage folder.
            </p>
            <a href="/api/admin/backup" className="btn-outline mt-4 px-4 py-2 text-sm">Download database backup</a>
          </section>

          <section className="card p-6">
            <h2 className="text-xl">Private book PDFs</h2>
            <p className="mt-1 text-sm text-muted">
              Place each PDF in <code>{PRIVATE_BOOKS_DIR}</code> on the server with the file name shown. These files are never publicly accessible.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {pdfs.map((p) => (
                <li key={p.slug} className="flex items-center justify-between gap-3">
                  <code className="text-xs break-all">{p.slug}.pdf</code>
                  <span className={p.ok ? "text-emerald-700" : "text-amber-700"}>{p.ok ? "Found" : "Missing or unreadable — can’t be ordered"}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-6">
            <h2 className="text-xl">Ad destination URLs</h2>
            <p className="mt-1 text-sm text-muted">
              Use these as the final URL in Google, Facebook or Instagram ads. Change the <code>utm_</code> values for each campaign — they appear on every order.
            </p>
            <ul className="mt-4 space-y-4 text-xs">
              <AdUrl label="Whole series (ad landing page)" path="/lp/series" campaign="series" />
              {ALL_BOOKS.map((b) => (
                <AdUrl key={b.slug} label={`Volume ${b.volume} — landing page`} path={`/lp/${b.slug}`} campaign={`vol${b.volume}`} alt={`/books/${b.slug}`} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

function AdUrl({ label, path: p, campaign, alt }: { label: string; path: string; campaign: string; alt?: string }) {
  return (
    <li>
      <p className="font-semibold text-ink">{label}</p>
      <p className="mt-1 break-all text-muted">
        Google: <code>{`${SITE_URL}${p}?utm_source=google&utm_medium=cpc&utm_campaign=${campaign}`}</code>
      </p>
      <p className="break-all text-muted">
        Meta: <code>{`${SITE_URL}${p}?utm_source=facebook&utm_medium=paid_social&utm_campaign=${campaign}`}</code>
      </p>
      {alt && (
        <p className="break-all text-muted">
          Full book page: <code>{`${SITE_URL}${alt}`}</code>
        </p>
      )}
    </li>
  );
}
