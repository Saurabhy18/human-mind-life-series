"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatMoney, type PurchaseSelection } from "@/config/packages";
import { getAttribution } from "@/lib/tracking-params";
import { useAuth } from "@/components/auth/AuthContext";
import { IconShield, IconUpload } from "../icons";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

type Errors = Record<string, string>;

/**
 * "Payment completed?" form for the UPI QR flow. The package, ebooks and languages come from the checkout
 * selection; the server re-checks them and sets the price itself.
 */
export function PaymentForm({ selection, amount, summary, upiId }: { selection: PurchaseSelection; amount: number; summary: string; upiId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [manualName, setManualName] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState<string | null>(null);
  const defaultName = user ? (user.fullName || (user.email ? user.email.split("@")[0] : "")) : "";
  const defaultEmail = user?.email || "";
  const buyerName = manualName !== null ? manualName : defaultName;
  const email = manualEmail !== null ? manualEmail : defaultEmail;

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const price = formatMoney(amount, "INR");

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
    if (!data.get("buyerName") && buyerName) data.set("buyerName", buyerName.trim());
    if (!data.get("email") && email) data.set("email", email.trim().toLowerCase());
    data.set("amountPaid", String(amount));

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErrors((er) => ({ ...er, screenshot: "Please attach your payment screenshot." }));
      fileRef.current?.focus();
      return;
    }
    data.set("packageId", selection.packageId);
    data.set("items", JSON.stringify(selection.items));
    data.set("tracking", JSON.stringify(getAttribution() ?? {}));

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", { method: "POST", body: data });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; ref?: string; accessToken?: string; message?: string; errors?: Errors };
      if (res.ok && json.ok && json.ref) {
        // The private order token travels in the URL fragment, which is never sent to the server or logged.
        const book = selection.items.length === 1 ? `&book=${encodeURIComponent(selection.items[0].bookId)}` : "";
        router.push(`/order/thank-you?ref=${encodeURIComponent(json.ref)}&package=${selection.packageId}${book}${json.accessToken ? `#t=${json.accessToken}` : ""}`);
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

      {user ? (
        <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-xs text-ink/80 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 break-words">
            Ordering as <strong className="text-ink font-semibold">{user.fullName || user.email}</strong> ({user.email})
          </p>
          <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-gold-dark shrink-0">
            Logged In
          </span>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-cream/40 px-4 py-3 text-xs text-muted flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink/80 font-medium">Guest Checkout (No account required)</p>
          <a
            href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/checkout")}`}
            className="text-gold-dark font-medium hover:underline text-xs shrink-0"
          >
            Sign in
          </a>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="buyerName" className="label">Buyer Name *</label>
          <input
            id="buyerName"
            name="buyerName"
            className="input"
            autoComplete="name"
            placeholder="Your full name"
            value={buyerName}
            onChange={(e) => setManualName(e.target.value)}
            required
            maxLength={80}
            {...aria("buyerName")}
          />
          {err("buyerName")}
        </div>
        <div>
          <label htmlFor="email" className="label">Email Address *</label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            autoComplete="email"
            inputMode="email"
            placeholder="your.email@example.com"
            value={email}
            onChange={(e) => setManualEmail(e.target.value)}
            required
            maxLength={120}
            {...aria("email")}
          />
          <p className="mt-1 text-xs text-muted">Your order receipt and ebook downloads will be sent to this email.</p>
          {err("email")}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="whatsapp" className="label">WhatsApp Number *</label>
          <input id="whatsapp" name="whatsapp" type="tel" className="input" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" required maxLength={20} {...aria("whatsapp")} />
          {err("whatsapp")}
        </div>
      </div>

      <div>
        <label htmlFor="amountPaid" className="label">Amount Paid (₹) *</label>
        <input
          key={amount}
          id="amountPaid"
          name="amountPaid"
          className="input bg-neutral-100/70 font-semibold cursor-not-allowed select-none text-ink"
          inputMode="decimal"
          autoComplete="off"
          value={String(amount)}
          readOnly
          required
          maxLength={10}
          {...aria("amountPaid")}
        />
        <p className="mt-1.5 text-xs text-muted">Fixed price: your payment must be exactly ₹{amount} for this order.</p>
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
            I confirm that I have paid <strong>{price}</strong> to UPI ID <strong className="break-all">{upiId}</strong> for <strong>{summary}</strong>, and that the details above are
            correct. I agree to the{" "}
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
        Your payment will be manually verified before your ebooks are delivered. We will never ask for your UPI PIN, OTP, bank password, card number or CVV.
      </p>
    </form>
  );
}
