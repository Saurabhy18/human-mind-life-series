# The Human Mind & Life Series — Book Store Website

A complete, production-ready website for the six volumes of **The Human Mind & Life Series**. Volumes 1–5 are sold using **UPI QR-code payments only**, with manual payment verification and manual delivery. **Volume 6, *The Intimacy Code*, is free**: readers get it through a short form, with no payment involved.

Built with **Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · SQLite**.

---

## 1. Quick start (on your computer)

Requires **Node.js 20.9 or newer** (Node 24 LTS recommended).

```bash
npm install
npm run setup-admin        # choose your admin password (creates .env.local)
npm run dev                # open http://localhost:3000
```

Production:

```bash
npm run build
npm start                  # serves on port 3000
```

---

## 2. Where to change things

| What | File |
|---|---|
| Site/series name, the **six author pen names** (`AUTHOR_VOLUME_1` … `AUTHOR_VOLUME_6`), email, WhatsApp, **UPI ID**, **QR code**, **prices**, covers, social links, **tracking IDs** | `src/config/site.config.ts` |
| Book titles, descriptions, "what you'll learn", topics, **chapters**, **preview excerpts**, book FAQs, disclaimers | `src/content/books.ts` |
| Series description, mission, "why the series was created", reader benefits | `src/content/books.ts` (bottom: `SERIES`) |
| General FAQs | `src/content/faqs.ts` |
| Privacy / Terms / Refund pages | `src/app/(site)/privacy-policy`, `terms-and-conditions`, `refund-policy` |
| Admin password / session secret | `.env.local` (run `npm run setup-admin`) |

Any value written like `"[SOMETHING]"` or `"YOUR_SOMETHING"` (e.g. `YOUR_EMAIL`, `YOUR_WHATSAPP_NUMBER`) is a **placeholder**. Unfilled links (social media, WhatsApp) are hidden on the live site, and the admin **Setup & Ads** page (`/admin/setup`) lists everything still to fill in.

### Images
- **UPI QR code (required):** copy your **original, unedited** QR image to `public/images/upi-qr.png` (already set as `UPI_QR_CODE`). If your file is a `.jpg`, use `public/images/upi-qr.jpg` and change the path in the config. The site shows it byte-for-byte at its natural size and shape — it is never regenerated, cropped or recompressed. Until the file exists, the payment page shows the UPI ID with a "QR temporarily unavailable" note.
- **Book covers:** save as `public/images/covers/volume-1.jpg` … → set `BOOK_COVER_1: "/images/covers/volume-1.jpg"` etc. Until then, an elegant typographic cover is shown. Recommended: 2:3 portrait, at least 800 × 1200 px.
- **Volume 6 cover:** `public/images/covers/volume-6.png`, taken unchanged from the book's own PDF.
- **Authors:** the site shows the pen names only (with a monogram) — no photos, biographies or credentials.
- After adding or changing images, run `npm run build` again (Next.js only serves files that were in `public/` at build time).

### Complete-series offer
In `site.config.ts` set `SERIES_BUNDLE: { enabled: true, price: 999 }`. A "Complete Series" product, payment page (`/checkout/complete-series`) and banners appear automatically.

---

## 3. How a purchase works

```
Home → Book page → Buy Now → Payment page (/checkout/<book>)
  → customer scans your UPI QR & pays
  → submits Name, Email, WhatsApp, Book, Amount Paid, UTR, payment screenshot
  → Thank-you page (order reference, status "Pending Verification")
  → YOU verify the payment in your bank/UPI app (admin panel)
  → YOU send the PDF by email/WhatsApp → mark "Book Delivered"
```

- Orders are **never** marked paid automatically.
- The price is always taken from the server, never from the browser.
- Each UTR can be submitted only once (blocks duplicate/reused UTRs).
- No UPI PIN, OTP, bank password, card number or CVV is ever requested or stored.

### Free book (Volume 6 — The Intimacy Code)

Any book whose price is `0` (`BOOK_6_PRICE: 0`) is automatically treated as a **free book**:

```
Home → Volume 6 page (/books/volume-6) → GET FREE BOOK
  → form: Name, Email, WhatsApp (optional), 18+ confirmation
  → "Your free copy request has been received."
  → personal download link (FREE_BOOK_INSTANT_DOWNLOAD: true)
     or "FREE — PENDING DELIVERY" → you send the PDF from Admin → Free Requests
```

- No payment page, QR code, UTR, amount or screenshot. `/checkout/volume-6` always redirects to the free form, and the paid-order API rejects free books.
- The PDF stays private in `storage/books/volume-6.pdf`. Each reader gets a **personal link** that expires after `FREE_DOWNLOAD_LINK_HOURS` (48 h) and works `FREE_DOWNLOAD_LIMIT` (3) times. Only a hash of the link is stored.
- Set `FREE_BOOK_INSTANT_DOWNLOAD: false` to deliver every free copy by hand instead.
- Ad landing page: `/lp/volume-6`.

---

## 4. Admin / order management

Open **`/admin`** and sign in with the password you set via `npm run setup-admin`.

- **Paid Orders** (`/admin`): customer name, email, WhatsApp, book, author, price + amount paid (highlighted red if they don't match), UTR, payment screenshot, status, marketing source (UTM). Filter by status, search, export CSV.
- **Statuses:** Pending Verification → Payment Verified / Payment Rejected → Book Delivered. Every change is logged in the order history.
- **Delivery:** each order page has *Download PDF*, *Open delivery email* and *Open WhatsApp chat* buttons with a pre-written message.
- **Free Requests** (`/admin/free-requests`, kept separate from paid orders): name, email, WhatsApp, book, request date, download count, delivery status (**Free Request Received → Free Book Sent → Completed**), CSV export. A request is marked *Free Book Sent* automatically the first time the reader uses their download link.
- **Messages:** contact-form enquiries (including business enquiries).
- **Setup & Ads:** placeholder checklist, private PDF status, ready-made ad URLs.

> **Always confirm the money arrived in your bank/UPI app before marking an order verified.** Screenshots can be faked; the UTR + amount in your statement is the proof.

### Private book PDFs (never public)
Put the PDFs on the server in `storage/books/`, named after each book's slug:

```
storage/books/the-psychology-of-human-behavior.pdf
storage/books/why-people-do-what-they-do.pdf
storage/books/ancient-wisdom-for-the-modern-mind.pdf
storage/books/volume-4.pdf
storage/books/a-healthy-sex-life-at-any-age.pdf
storage/books/volume-6.pdf          ← The Intimacy Code (already copied in)
```

They can only be downloaded by a logged-in admin. The one exception is free books, which readers can download only through their own expiring personal link. **Never put PDFs in the `public/` folder.**

### Private data
`storage/` holds `orders.db` (SQLite), `payment-screenshots/` and `books/`. It is outside `public/`, excluded from git, and must be **backed up regularly**. Change its location with `STORAGE_DIR` in `.env.local`.

---

## 5. Ads, analytics & tracking

In `src/config/site.config.ts`:

| Placeholder | Example |
|---|---|
| `GOOGLE_ANALYTICS_ID` | `G-ABC123XYZ` |
| `GOOGLE_ADS_ID` | `AW-123456789` |
| `GOOGLE_ADS_LEAD_CONVERSION_LABEL` | `AbC-D_efG-h12` |
| `META_PIXEL_ID` | `1234567890123456` |

Scripts load only when an ID is filled in (and never inside `/admin`).

**Events sent automatically**

| Step | GA4 | Meta Pixel | Google Ads |
|---|---|---|---|
| Book/landing page viewed | `view_item` | `ViewContent` | — |
| Payment page opened | `begin_checkout` | `InitiateCheckout` | — |
| Payment details submitted | `generate_lead` | `Lead` | conversion (lead label) |
| Free book requested (Vol 6) | `generate_lead` (`lead_type: free_book`, value 0) | `Lead` | conversion (`GOOGLE_ADS_FREE_BOOK_CONVERSION_LABEL`) |
| Contact form sent | `contact` | `Contact` | — |

Because payments are verified manually, a submission is tracked as a **lead**. Set `TRACK_SUBMISSION_AS_PURCHASE: true` to also send `purchase` / `Purchase` events (useful for ad optimisation, but this includes unverified submissions).

**Ad landing pages** (focused pages without navigation, hidden from Google search):

- `/lp/series` for the whole series
- `/lp/<book-slug>` for one book, e.g. `/lp/the-psychology-of-human-behavior`

Ads can also point straight to the full book pages, `/books/<book-slug>`.

**UTM tracking:** add parameters to every ad URL, for example
`https://yourdomain.com/lp/why-people-do-what-they-do?utm_source=facebook&utm_medium=paid_social&utm_campaign=vol2_oct`.
The site remembers them for 30 days, and each order shows its source in the admin panel and in the CSV export. `gclid` and `fbclid` are captured too.

---

## 6. SEO

The site includes:

- A unique title, meta description, canonical URL and Open Graph/Twitter tags on every page.
- Generated 1200×630 share images for the site (`/opengraph-image`) and for each book (`/og/books/<slug>`).
- Schema.org data:
  - `Book` + `Product` with an INR `Offer` on book pages
  - `BookSeries`, `Organization`, `FAQPage` and `BreadcrumbList`
- `/sitemap.xml` and `/robots.txt`. Checkout, thank-you, admin and API URLs are excluded.
- One `<h1>` per page and a logical H2 structure.

Set `SITE_URL` to your real domain before going live, then submit `https://yourdomain.com/sitemap.xml` in Google Search Console.

---

## 7. Deployment

This site stores orders and screenshots on disk, so it needs a host with a **persistent disk** that runs Node.js. For example:

- **A VPS** (Hostinger VPS, DigitalOcean, AWS Lightsail, etc.) running `npm run build && npm start` behind Nginx with free HTTPS from Let's Encrypt. Keep it running with `pm2`.
- **Railway / Render / Fly.io** with a persistent volume. Set `STORAGE_DIR` to the volume path.

> Serverless hosts like Vercel or Netlify **do not keep files between requests**, so orders and screenshots would be lost there. Moving to one of them would mean switching to a hosted database plus file storage.

Checklist before going live:

1. Fill in `src/config/site.config.ts` (see `/admin/setup`), including your **real prices**.
2. Check the book content in `src/content/books.ts` against your manuscripts.
3. Run `npm run setup-admin` **on the server** with a strong password.
4. Serve over **HTTPS**. Security headers (HSTS, CSP, etc.) are already configured.
5. Upload the PDFs to `storage/books/`.
6. Set up daily backups of `storage/`.
7. Place a test order yourself and walk it through to "Book Delivered".
8. Have a legal professional review the Privacy, Terms and Refund pages.

---

## 8. Security summary

- **Admin sessions:**
  - The password is stored only as a salted scrypt hash.
  - Sessions are signed, HTTP-only, SameSite=Strict cookies that expire after 8 hours.
  - Logins are rate-limited.
- **Admin checks:** every admin page, action and API route checks the session itself.
- **Uploads:**
  - JPG, PNG and WEBP only, checked by the file's real bytes rather than its name.
  - 5 MB maximum.
  - Files get random names and are stored outside `public/`.
- **Public pages:** they never show customer data. The thank-you page shows only a random order reference.
- **Forms:**
  - Same-origin check on every submission.
  - Server-side validation.
  - Honeypot field to catch spam bots.
  - Rate limiting.
- **CSV export:** protected against spreadsheet formula injection.
- **IP addresses:** stored only as salted hashes.

## 9. Multilingual books (Google Cloud Translation)

Customers can choose the language they want a paid book in. The English source is translated with **Google Cloud Translation – Advanced (v3)**, stored privately and unlocked only after payment is verified **on the server**.

```
Ad → book page → choose language → Buy Now → pay (UPI QR or gateway)
  → payment verified server-side (admin "Payment Verified"  OR  signed gateway webhook + API re-check)
  → cached translation reused, or ONE translation job queued
  → background worker: split → translate → rebuild/merge → private storage
  → order ready → email with private link → short-lived signed download
```

**What is offered:** a book shows the language dropdown only when **(a)** Google is configured and **(b)** its English source PDF is on the server at `storage/books/<slug>.pdf`. Otherwise it is sold in English and delivered as before. Today only Volume 4 (`volume-4.pdf`) and the free Volume 6 have source files.

### 9.1 How translation works

| Strategy | `TRANSLATION_STRATEGY` | How | Formatting | Google price* |
|---|---|---|---|---|
| **Document** (default) | `document` | The PDF is split into parts (≤ 300 pages / 20 MB each), each part goes through Google **Document Translation**, then the parts are merged. | Keeps the original layout, fonts, images, tables and page structure (as well as Google can). Text inside images (e.g. the cover) is not translated. | $0.08 per page |
| **Text** | `text` | Text is extracted with its structure (headings, paragraphs, lists, cover/image pages), split into ≤ 5,000-character requests, translated, and rebuilt into a PDF with Chromium. | Same trim size; cover and image-only pages copied unchanged; running header/footer regenerated. Inline images and tables inside text pages are **not** kept. | $20 per million characters (first 500,000/month free) |

\*List prices checked on 7 Oct 2026. Always confirm on Google's pricing page.

- **Caching:** cache key = `book + source + target + source version`, e.g. `volume-4:en:fr:v-3fa94c1e0b2d`. Each book/language pair is translated **once**; every later order is served from the stored file. The version is a fingerprint of the source PDF, so replacing the PDF automatically invalidates old translations.
- **No duplicate jobs:** one job per cache key (database UNIQUE constraint), even if many customers pay at once.
- **Retries:** 3 attempts with exponential backoff (30 s, 60 s…), then FAILED. **Admin → Translations → Retry**.
- **Never inside an HTTP request:** the worker is a separate process (`npm run worker`). Later it can move to BullMQ/Redis, Cloud Tasks, Pub/Sub or Cloud Run Jobs: only the queue changes (`runJob()` stays the same).
- **Languages:** fetched live from Google (`getSupportedLanguages`, target-capable only), cached 24 h, with the last good list kept on disk. Every order's language is validated against that list on the server.
- **Machine translation:** the dropdown says so. For important books, have a native speaker review a translation before selling widely (Admin → Translations → Download).

### 9.2 Google Cloud setup (one time)

1. Create or choose a project at <https://console.cloud.google.com> and **enable billing**.
2. Enable the API: `gcloud services enable translate.googleapis.com` (or *APIs & Services → Enable APIs → Cloud Translation API*).
3. **Local development:** install the gcloud CLI, then `gcloud auth application-default login` and `gcloud auth application-default set-quota-project YOUR_PROJECT_ID`.
4. **Production:** create a service account with the role **Cloud Translation API User** (`roles/cloudtranslate.user`). If you use GCS storage, also give it **Storage Object Admin** on that one bucket.
   - On Google Cloud (Cloud Run / GCE), attach the service account (workload identity), so no key file is needed.
   - On any other server, create a JSON key, store it **outside** the project folder, and set `GOOGLE_APPLICATION_CREDENTIALS=/secure/path/key.json`.
5. In `.env.local` set `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_LOCATION=global` and `TRANSLATION_STRATEGY`.
6. **Recommended:** set a budget alert in *Billing → Budgets & alerts*, and cap the API quota (*APIs & Services → Cloud Translation API → Quotas*).

Credentials are read only by the server and worker through Google's Application Default Credentials. They are never in the source code, the browser, API responses or git (`.env*` is git-ignored).

### 9.3 Payments

- **`PAYMENT_PROVIDER=manual_upi`** (default, unchanged): customers pay your UPI QR and submit UTR + screenshot (now also the language). When you click **Payment Verified** in the admin panel, that counts as the server-side verification and starts delivery.
- **`PAYMENT_PROVIDER=razorpay`** (optional gateway):
  1. Get API keys in the Razorpay Dashboard (*Settings → API Keys*): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`. On your computer only **test-mode** keys (`rzp_test_…`) are accepted, so local testing can't charge real money. Live keys work only on the production server.
  2. Add a webhook in *Settings → Webhooks*: URL `https://your-domain.com/api/payment/webhook`, events `payment.captured`, `order.paid`, `payment.failed`, and a secret → `RAZORPAY_WEBHOOK_SECRET`.
  3. Restart. The payment page now shows a language dropdown, name, email and **BUY NOW**, then opens Razorpay Checkout.
  - The webhook is accepted only if all of these hold:
    - the HMAC signature matches;
    - the gateway order, receipt, **amount** and **currency** match ours;
    - the payment is captured;
    - Razorpay's own API confirms the order is paid.
  - The Razorpay payment ID is the idempotency key, so repeated webhooks are ignored.
  - The browser's "success" callback only triggers a server-to-server check; it never unlocks anything.

### 9.4 API

All responses are JSON. "Token" means the customer's private order token, sent as the `X-Order-Token` header. The customer receives it on the confirmation page and in emails, inside the URL fragment `#t=…`, which is never sent to the server or logged. Only a SHA-256 hash of each token is stored.

| Method & path | Purpose |
|---|---|
| `GET /api/languages` | `{ success, languages: [{ code, name }] }`. English (original) first. |
| `GET /api/books/:bookId` | Public book info: `id, title, author, sourceLanguage, price, currency, active, multilingual`. The file path is never exposed. |
| `POST /api/orders` (JSON, gateway) | `{ bookId, targetLanguage, customerName, customerEmail, consent: true }` → `{ success, orderId, amount, currency, paymentRequired, accessToken }`. The price comes from the server. |
| `POST /api/orders` (multipart, UPI) | Existing UPI form plus `targetLanguage` → `{ ok, ref, accessToken }`. |
| `POST /api/payment/create` + token | `{ orderId }` → `{ success, checkout: { keyId, providerOrderId, amount, currency, … } }`. Never includes the secret. |
| `POST /api/payment/webhook` | Razorpay → server. Signature-verified and idempotent. |
| `POST /api/payment/verify` + token | Asks the gateway (server to server) whether the order is paid. Ignores anything the browser sends. |
| `GET /api/orders/:orderId/status` + token | `{ orderId, paymentStatus, fulfillmentStatus, stage, progress, targetLanguage, downloadsRemaining, accessExpiresAt }` |
| `GET /api/orders/:orderId/download` + token | `{ success, downloadUrl, expiresInSeconds }` only if PAID + COMPLETED, within the access window and download limit. Otherwise 402 `NOT_PAID`, 409 `NOT_READY`, 410 `EXPIRED`, 429 `LIMIT_REACHED`, or 404 for unknown order / wrong token (the same response for both, so references can't be probed). |
| `GET /api/files/...?exp&name&sig` | Serves a privately stored file only with a valid, unexpired HMAC signature (local storage). With GCS, signed URLs point at the private bucket instead. |
| Admin: `GET /api/admin/translations/:id/file` | Admin-only download of a translated book. |

Customer pages: `/order/status/<orderId>#t=<token>` shows Payment Pending → Payment Successful → Preparing → Translating → Generating → Ready (Download Book) / Failed.

### 9.5 Database changes (applied automatically on start-up)

The SQLite schema upgrades itself; there is no manual migration step. Existing orders keep working: verified orders are marked PAID.

- `orders` gains these columns:
  - `source_language`, `target_language`, `currency`, `customer_id`
  - `payment_status` (PENDING / PAID / FAILED / REFUNDED), `payment_provider`, `provider_order_id`, `paid_at`
  - `fulfillment_status` (NOT_STARTED / PROCESSING / COMPLETED / FAILED), `cache_key`, `translated_book_id`
  - `access_expires_at`, `download_count`, `ready_email_sent_at`, `processing_email_sent_at`
- New tables:
  - `customers`
  - `payments` (unique `idempotency_key`)
  - `translation_jobs` (unique `cache_key`, status, phase, progress, attempts, characters/pages, estimated cost, timings)
  - `translated_books` (unique `cache_key`)
  - `order_access_tokens` (hashed)
  - `download_logs`
- Books stay defined in code (`src/content/books.ts` + `site.config.ts`). The source file is `storage/books/<slug>.pdf`.

### 9.6 Local development & testing

```bash
npm install
cp .env.example .env.local      # then fill in, or run: npm run setup-admin
npm run dev                     # website  → http://localhost:3000
npm run worker                  # second terminal: translation worker
npm test                        # 50 automated tests (no Google account or cost needed)
```

**Trying it without Google:** put `TRANSLATION_PROVIDER=fake` in `.env.local` (development only; it is always switched off in production, with no override). Translated books then contain markers such as `[fr] …` instead of real translations, which lets you test the whole flow for free. Chrome or Chromium is needed for the text strategy (`CHROMIUM_PATH`).

**What the tests cover:**
- languages API
- order creation and validation
- payment: success, failure, cancellation (no webhook), duplicate webhooks, wrong amount, wrong currency, invalid or tampered signature, gateway outage and retry, an unconfirmed payment
- translation English → French, Spanish, Japanese, Chinese and Hindi
- structure preservation, caching, deduplication, source versioning, retry and failure
- the document strategy's split and merge
- downloads: unpaid denied, paid-but-processing "not ready", completed allowed, expired link, tampered link, invalid order, another customer's token, download limit, access period
- the emailed link

Test pages and webhooks can be sent to Razorpay **test mode** keys before going live.

### 9.7 Production

- Run **both** processes and keep them running, e.g. with pm2:

  ```bash
  npm run build
  pm2 start npm --name books -- start
  pm2 start npm --name books-worker -- run worker
  pm2 save
  ```

- **Text strategy only:**
  - Install Chromium and fonts for every script you sell. On Ubuntu: `sudo apt install chromium fonts-noto fonts-noto-cjk fonts-noto-extra`.
  - Set `CHROMIUM_PATH`.
- **Storage:**
  - **Local disk (`storage/`):** must be persistent and backed up.
  - **Private GCS bucket:** set `BOOK_STORAGE_BUCKET`. Keep "public access prevention" ON, and give the service account object access.
- **HTTPS** and security headers are already configured. The Razorpay domains are added to the Content-Security-Policy automatically when `PAYMENT_PROVIDER=razorpay`.
- Upload each English source PDF to `storage/books/<slug>.pdf`. Only process books you own or have the rights to translate and distribute.

### 9.8 Estimated Google cost per book

Measured on Volume 4 *Intimacy After 50* (55 pages, **69,414 characters** sent for translation):

| Strategy | Per language (one time) | Notes |
|---|---|---|
| Text (`$20` / 1M chars) | **≈ $1.39** | About 7 languages a month fit in the 500,000-character free tier. |
| Document (`$0.08` / page) | **≈ $4.40** | Keeps the original layout. |

Because of caching this is paid **once per book per language**, not per customer. For example, 500 French sales cost one French translation. *Admin → Translations* shows characters, pages and estimated cost per job. Check actual charges in Google Cloud Billing.

### 9.9 Known limitations

- **Machine translation:** quality varies by language. Have important languages reviewed by a native speaker.
- **Document strategy:**
  - Only text-based ("native") PDFs; scanned PDFs need OCR.
  - Text inside images, including the cover, stays in English.
  - Complex layouts can shift.
- **Text strategy:**
  - Keeps headings, paragraphs, lists and image-only pages (such as the cover), but not inline images or tables on text pages.
  - Fonts follow what is installed on the server.
- **Source formats:** only PDF today. EPUB, DOCX and TXT need a new `BookParser`; the abstraction is in `src/lib/server/translation/bookContent.ts`.
- **Download protection:** downloaded PDFs can still be copied or shared. Short-lived signed links, per-order download limits, access windows and logging reduce misuse but can't prevent it.
- **Scaling:** the rate limiter and SQLite queue suit one server. Use Redis/BullMQ (or Cloud Tasks) and a shared database before running several servers.
- **Not tested against live services:** the Google API and Razorpay are tested with stand-ins (a fake translator and a mock Razorpay API), not live. Do one real order in Razorpay test mode and one real Google translation before launch.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run worker` | Background translation worker (run alongside the server) |
| `npm test` | Automated tests (Vitest) |
| `npm run setup-admin` | Set or change the admin password |
| `npm run lint` / `npm run typecheck` | Code checks |
