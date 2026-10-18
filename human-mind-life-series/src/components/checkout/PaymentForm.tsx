"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const { user, loading } = useAuth();
  const [buyerName, setBuyerName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const price = formatMoney(amount, "INR");

  useEffect(() => {
    if (user) {
      if (!buyerName) {
        setBuyerName(user.fullName || (user.email ? user.email.split("@")[0] : ""));
      }
      if (!email && user.email) {
        setEmail(user.email);
      }
    }
  }, [user, buyerName, email]);

  if (loading) {
    return (
      <div className="card p-8 text-center text-muted">
        <p className="animate-pulse">Checking account status...</p>
      </div>
    );
  }

  if (!user) {
    const nextUrl = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/checkout";
    const saveAndRedirect = (url: string) => {
      try {
        sessionStorage.setItem("hm:pending-checkout", JSON.stringify(selection));
      } catch {}
      router.push(url);
    };

    return (
      <div className="rounded-2xl border border-gold/40 bg-cream/70 p-6 sm:p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold-dark mb-4">
          <IconShield width={24} height={24} />
        </div>
        <h3 className="text-xl font-serif text-ink">Sign in to complete your purchase</h3>
        <p className="mt-2 text-sm text-muted max-w-md mx-auto">
          You must be logged in to submit payment details and place your order. Your ebooks will be linked to your personal account library.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => saveAndRedirect(`/login?next=${encodeURIComponent(nextUrl)}`)}
            className="btn-primary w-full sm:w-auto px-6 py-2.5 text-center"
          >
            Sign In to Continue
          </button>
          <button
            type="button"
            onClick={() => saveAndRedirect(`/signup?next=${encodeURIComponent(nextUrl)}`)}
            className="btn-outline w-full sm:w-auto px-6 py-2.5 text-center"
          >
            Create an Account
          </button>
        </div>
      </div>
    );
  }


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
    if (!data.get("buyerName") && buyerName) data.set("buyerName", buyerName.trim());
    if (!data.get("email") && email) data.set("email", email.trim().toLowerCase());

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

      {user && (
        <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-xs text-ink/80 flex items-center justify-between">
          <p>
            Ordering as <strong className="text-ink font-semibold">{user.fullName || user.email}</strong> ({user.email})
          </p>
          <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-gold-dark">
            Logged In
          </span>
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
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            required
            maxLength={80}
            {...aria("buyerName")}
          />
          {err("buyerName")}
        </div>
        <div>
          <label htmlFor="email" className="label">Account Email</label>
          <input
            id="email"
            name="email"
            type="email"
            className="input bg-cream/40 cursor-not-allowed font-medium text-ink/80"
            autoComplete="email"
            inputMode="email"
            value={email}
            readOnly
            required
            maxLength={120}
            {...aria("email")}
          />
          <p className="mt-1 text-xs text-muted">Your order and library access will be linked to this account email.</p>
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
          className="input"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={String(amount)}
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
