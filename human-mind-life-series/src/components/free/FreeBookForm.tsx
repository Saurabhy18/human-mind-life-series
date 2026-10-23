"use client";

import { useState } from "react";
import { getAttribution } from "@/lib/tracking-params";
import { trackFreeBookRequest } from "@/lib/analytics";
import { useAuth } from "@/components/auth/AuthContext";
import { IconCheck, IconClock, IconShield } from "../icons";

type Errors = Record<string, string>;
type Result = { ref: string; downloadUrl: string | null };

/**
 * "Get Free Book" form for books priced at ₹0. It has NO payment fields:
 * no QR code, no UTR, no amount and no screenshot.
 * Anyone can download, whether logged in or not.
 */
export function FreeBookForm({
  book,
  adultsOnly,
  linkLimit,
  tone = "light",
}: {
  book: { slug: string; label: string; title: string };
  adultsOnly?: boolean;
  linkLimit: number;
  tone?: "light" | "dark";
}) {
  const { user } = useAuth();
  const [manualName, setManualName] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState<string | null>(null);
  const name = manualName ?? user?.fullName ?? "";
  const email = manualEmail ?? user?.email ?? "";

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const dark = tone === "dark";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;

    setSubmitting(true);
    try {
      const res = await fetch("/api/free-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, book: book.slug, tracking: getAttribution() ?? {} }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; ref?: string; downloadUrl?: string | null; message?: string; errors?: Errors };
      if (res.ok && json.ok && json.ref) {
        setErrors({});
        setResult({ ref: json.ref, downloadUrl: json.downloadUrl ?? null });
        trackFreeBookRequest({ slug: book.slug, label: book.label, price: 0 }, json.ref);
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

  if (result) {
    return (
      <div role="status" className={`rounded-2xl p-6 text-center sm:p-8 ${dark ? "bg-white text-ink" : "border border-success/25 bg-success/5"}`}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
          <IconCheck width={28} height={28} />
        </div>
        <h3 className="mt-4 text-2xl">Your free copy request has been received.</h3>
        <p className="mt-3 text-sm text-muted">
          Request reference: <span className="font-mono font-semibold text-ink">{result.ref}</span>
        </p>

        {result.downloadUrl ? (
          <>
            <a href={result.downloadUrl} className="btn-free mt-6 w-full max-w-sm py-4 text-base">
              Download {book.title} (PDF)
            </a>
            <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-muted">
              This is your personal link, for your use only (up to {linkLimit} downloads). Please do not share it.
            </p>
          </>
        ) : (
          <div className="mx-auto mt-6 max-w-sm rounded-xl border border-line bg-white p-4 text-left">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <IconClock width={18} className="text-gold-dark" /> Status: <span className="tracking-wide text-success">FREE — PENDING DELIVERY</span>
            </p>
            <p className="mt-2 text-sm text-muted">We will send your free copy to the email address (and WhatsApp number, if provided) you entered.</p>
          </div>
        )}
      </div>
    );
  }

  const err = (name: string) =>
    errors[name] ? (
      <p id={`free-${name}-error`} className={`mt-1.5 text-sm ${dark ? "text-red-300" : "text-danger"}`}>
        {errors[name]}
      </p>
    ) : null;
  const aria = (name: string) => ({ "aria-invalid": !!errors[name] || undefined, "aria-describedby": errors[name] ? `free-${name}-error` : undefined });
  const label = `label ${dark ? "text-white" : ""}`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {user && (
        <div className={`rounded-xl border p-3 text-xs flex items-center justify-between ${dark ? "bg-white/10 border-white/20 text-white" : "bg-gold/10 border-gold/25 text-ink/80"}`}>
          <p>
            Requesting copy as <strong className="font-semibold">{user.fullName || user.email}</strong> ({user.email})
          </p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${dark ? "bg-white/20 text-white" : "bg-gold/20 text-gold-dark"}`}>
            Logged In
          </span>
        </div>
      )}

      {/* Honeypot — hidden from people, catches spam bots */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label htmlFor="free-name" className={label}>Name *</label>
        <input
          id="free-name"
          name="name"
          className="input"
          autoComplete="name"
          value={name}
          onChange={(e) => setManualName(e.target.value)}
          required
          maxLength={80}
          {...aria("name")}
        />
        {err("name")}
      </div>
      <div>
        <label htmlFor="free-email" className={label}>Email Address *</label>
        <input
          id="free-email"
          name="email"
          type="email"
          className="input"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setManualEmail(e.target.value)}
          required
          maxLength={120}
          {...aria("email")}
        />
        {err("email")}
      </div>

      <div>
        <label htmlFor="free-whatsapp" className={label}>
          WhatsApp Number <span className={dark ? "font-normal text-white/60" : "font-normal text-muted"}>(optional)</span>
        </label>
        <input id="free-whatsapp" name="whatsapp" type="tel" className="input" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" maxLength={20} {...aria("whatsapp")} />
        {err("whatsapp")}
      </div>

      <div>
        <label className={`flex items-start gap-3 text-sm leading-relaxed ${dark ? "text-white/85" : "text-ink/85"}`}>
          <input type="checkbox" name="consent" className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-success)]" {...aria("consent")} />
          <span>
            {adultsOnly ? "I confirm that I am 18 years of age or older and I agree to the " : "I agree to the "}
            <a href="/terms-and-conditions" target="_blank" className="underline">Terms</a> and{" "}
            <a href="/privacy-policy" target="_blank" className="underline">Privacy Policy</a>.
          </span>
        </label>
        {err("consent")}
      </div>

      {formError && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {formError}
        </div>
      )}

      <button type="submit" disabled={submitting} className="btn-free w-full py-4 text-base">
        {submitting ? "Sending…" : "GET FREE BOOK"}
      </button>

      <p className={`flex items-start gap-2 text-xs leading-relaxed ${dark ? "text-white/60" : "text-muted"}`}>
        <IconShield width={16} className="mt-px shrink-0 text-gold" />
        No payment needed. We only use your details to send this book and help with your request.
      </p>
    </form>
  );
}
