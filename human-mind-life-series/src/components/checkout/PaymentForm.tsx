"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/products";
import { getAttribution } from "@/lib/tracking-params";
import { IconShield, IconUpload } from "../icons";
import { LanguageSelector } from "../translation/LanguageSelector";
import { LANG_RE, useUrlParam } from "../translation/useUrlParam";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

type Errors = Record<string, string>;

export function PaymentForm({ products, initialSlug, upiId }: { products: Product[]; initialSlug: string; upiId: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  // Language chosen on the book page arrives as ?lang=xx; the customer can still change it here.
  const urlLang = useUrlParam("lang", "query", LANG_RE);
  const [chosenLang, setChosenLang] = useState<string | null>(null);
  const lang = chosenLang ?? urlLang ?? "en";
  const onLang = useCallback((code: string) => setChosenLang(code), []);

  const product = useMemo(() => products.find((p) => p.slug === slug) ?? products[0], [products, slug]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setErrors((er) => {
      const next = { ...er };
      delete next.screenshot;
      return next;
    });
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFileName("");
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setErrors((er) => ({ ...er, screenshot: "Please upload a JPG, PNG or WEBP image." }));
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setErrors((er) => ({ ...er, screenshot: "The image is larger than 5 MB. Please upload a smaller screenshot." }));
      e.target.value = "";
      return;
    }
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const form = e.currentTarget;
    const data = new FormData(form);

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErrors((er) => ({ ...er, screenshot: "Please attach your payment screenshot." }));
      fileRef.current?.focus();
      return;
    }
    data.set("tracking", JSON.stringify(getAttribution() ?? {}));

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", { method: "POST", body: data });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; ref?: string; accessToken?: string; message?: string; errors?: Errors };
      if (res.ok && json.ok && json.ref) {
        // The private order token travels in the URL fragment, which is never sent to the server or logged.
        router.push(`/order/thank-you?ref=${encodeURIComponent(json.ref)}&book=${encodeURIComponent(product.slug)}${json.accessToken ? `#t=${json.accessToken}` : ""}`);
        return;
      }
      setErrors(json.errors ?? {});
      setFormError(json.message ?? "Something went wrong. Please try again.");
      const firstField = json.errors && Object.keys(json.errors)[0];
      if (firstField) (form.elements.namedItem(firstField) as HTMLElement | null)?.focus();
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const err = (name: string) =>
    errors[name] ? (
      <p id={`${name}-error`} className="mt-1.5 text-sm text-danger">
        {errors[name]}
      </p>
    ) : null;
  const aria = (name: string) => ({ "aria-invalid": !!errors[name] || undefined, "aria-describedby": errors[name] ? `${name}-error` : undefined });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" encType="multipart/form-data">
      {/* Honeypot — hidden from people, catches spam bots */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="buyerName" className="label">Buyer Name *</label>
          <input id="buyerName" name="buyerName" className="input" autoComplete="name" required maxLength={80} {...aria("buyerName")} />
          {err("buyerName")}
        </div>
        <div>
          <label htmlFor="email" className="label">Email Address *</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" inputMode="email" required maxLength={120} {...aria("email")} />
          {err("email")}
        </div>
        <div>
          <label htmlFor="whatsapp" className="label">WhatsApp Number *</label>
          <input id="whatsapp" name="whatsapp" type="tel" className="input" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" required maxLength={20} {...aria("whatsapp")} />
          {err("whatsapp")}
        </div>
        <div>
          <label htmlFor="product" className="label">Book Purchased *</label>
          <select id="product" name="product" className="input" value={slug} onChange={(e) => setSlug(e.target.value)} {...aria("product")}>
            {products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.label} — ₹{p.price.toLocaleString("en-IN")}
              </option>
            ))}
          </select>
          {err("product")}
        </div>
      </div>

      <LanguageSelector bookSlug={product.slug} value={lang} onChange={onLang} error={errors.targetLanguage} />

      <div>
        <label htmlFor="amountPaid" className="label">Amount Paid (₹) *</label>
        <input
          key={product.slug}
          id="amountPaid"
          name="amountPaid"
          className="input"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={String(product.price)}
          required
          maxLength={10}
          {...aria("amountPaid")}
        />
        <p className="mt-1.5 text-xs text-muted">Enter the exact amount shown in your UPI app for this payment.</p>
        {err("amountPaid")}
      </div>

      <div>
        <label htmlFor="utr" className="label">UTR / Transaction ID *</label>
        <input
          id="utr"
          name="utr"
          className="input font-mono tracking-wide uppercase"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="e.g. 412345678901"
          required
          maxLength={40}
          {...aria("utr")}
        />
        <p className="mt-1.5 text-xs text-muted">Find it in your UPI app under payment history → transaction details (usually a 12-digit number).</p>
        {err("utr")}
      </div>

      <div>
        <span className="label" id="screenshot-label">Upload Payment Screenshot *</span>
        <label
          htmlFor="screenshot"
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition hover:border-gold ${
            errors.screenshot ? "border-danger/60" : "border-line"
          } bg-white`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={preview} alt="Selected payment screenshot preview" className="max-h-56 rounded-lg object-contain" />
          ) : (
            <IconUpload width={28} height={28} className="text-gold-dark" />
          )}
          <span className="text-sm font-medium text-ink">{fileName || "Tap to choose your screenshot"}</span>
          <span className="text-xs text-muted">JPG, PNG or WEBP · max 5 MB</span>
        </label>
        <input
          ref={fileRef}
          id="screenshot"
          name="screenshot"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFile}
          className="sr-only"
          aria-labelledby="screenshot-label"
          {...aria("screenshot")}
        />
        {err("screenshot")}
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-ink/85">
          <input type="checkbox" name="consent" className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-ink)]" {...aria("consent")} />
          <span>
            I confirm that I have paid <strong>₹{product.price.toLocaleString("en-IN")}</strong> to UPI ID <strong className="break-all">{upiId}</strong> for{" "}
            <strong>{product.label}</strong>, and that the details above are correct. I agree to the{" "}
            <a href="/terms-and-conditions" target="_blank" className="underline">Terms</a>,{" "}
            <a href="/privacy-policy" target="_blank" className="underline">Privacy Policy</a> and{" "}
            <a href="/refund-policy" target="_blank" className="underline">Refund Policy</a>.
          </span>
        </label>
        {err("consent")}
      </div>

      {formError && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {formError}
        </div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full py-4 text-base">
        {submitting ? "Submitting…" : "Submit Payment Details"}
      </button>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <IconShield width={16} className="mt-px shrink-0 text-gold-dark" />
        Your payment will be manually verified before your book is delivered. We will never ask for your UPI PIN, OTP, bank password, card number or CVV.
      </p>
    </form>
  );
}
