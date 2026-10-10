"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { getAttribution } from "@/lib/tracking-params";
import { LanguageSelector } from "../translation/LanguageSelector";
import { LANG_RE, useUrlParam } from "../translation/useUrlParam";
import { IconShield } from "../icons";

type Checkout = { keyId: string; providerOrderId: string; amount: number; currency: string; name: string; description: string; prefill: { name: string; email: string } };
type RazorpayInstance = { open: () => void; on: (event: string, cb: (r: unknown) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the payment window."));
    document.head.appendChild(s);
  });
}

/**
 * Payment-gateway checkout (only when PAYMENT_PROVIDER=razorpay).
 * Order → gateway checkout → the SERVER confirms payment (webhook / API) → order page.
 * The browser's "success" callback is never trusted: it only triggers a server-side check.
 */
export function GatewayCheckout({ bookSlug, price }: { bookSlug: string; price: number }) {
  const router = useRouter();
  const urlLang = useUrlParam("lang", "query", LANG_RE);
  const [chosen, setChosen] = useState<string | null>(null);
  const lang = chosen ?? urlLang ?? "en";
  const onLang = useCallback((code: string) => setChosen(code), []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: bookSlug,
          targetLanguage: String(f.get("targetLanguage") || lang),
          customerName: String(f.get("customerName") || ""),
          customerEmail: String(f.get("customerEmail") || ""),
          consent: f.get("consent") === "on",
          website: String(f.get("website") || ""),
          tracking: getAttribution() ?? {},
        }),
      });
      const order = (await res.json()) as { success?: boolean; orderId?: string; accessToken?: string; message?: string; errors?: Record<string, string> };
      if (!res.ok || !order.success || !order.orderId || !order.accessToken) {
        setErrors(order.errors ?? {});
        setMessage(order.message ?? "Something went wrong. Please try again.");
        return;
      }
      setErrors({});
      const headers = { "Content-Type": "application/json", "x-order-token": order.accessToken };
      const statusPage = `/order/status/${order.orderId}#t=${order.accessToken}`;

      const pay = await fetch("/api/payment/create", { method: "POST", headers, body: JSON.stringify({ orderId: order.orderId }) });
      const payJson = (await pay.json()) as { success?: boolean; checkout?: Checkout; message?: string };
      if (!pay.ok || !payJson.checkout) {
        setMessage(payJson.message ?? "We could not start the payment.");
        return;
      }
      await loadRazorpay();
      const c = payJson.checkout;
      const rzp = new window.Razorpay!({
        key: c.keyId,
        order_id: c.providerOrderId,
        amount: c.amount,
        currency: c.currency,
        name: c.name,
        description: c.description,
        prefill: c.prefill,
        theme: { color: "#0f1b2d" },
        // Success here only means "go and check": the server verifies with the gateway itself.
        handler: () => router.push(statusPage),
        modal: { ondismiss: () => setMessage("Payment was cancelled. You have not been charged — you can try again.") },
      });
      rzp.on("payment.failed", () => setMessage("The payment did not go through. You have not been charged — please try again."));
      rzp.open();
    } catch {
      setMessage("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="hidden" aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <LanguageSelector bookSlug={bookSlug} value={lang} onChange={onLang} error={errors.targetLanguage} />
      <div>
        <label htmlFor="gw-name" className="label">Name *</label>
        <input id="gw-name" name="customerName" className="input" autoComplete="name" required maxLength={80} />
        {errors.customerName && <p className="mt-1.5 text-sm text-danger">{errors.customerName}</p>}
      </div>
      <div>
        <label htmlFor="gw-email" className="label">Email *</label>
        <input id="gw-email" name="customerEmail" type="email" className="input" autoComplete="email" required maxLength={120} placeholder="you@example.com" />
        {errors.customerEmail && <p className="mt-1.5 text-sm text-danger">{errors.customerEmail}</p>}
      </div>
      <label className="flex items-start gap-3 text-sm leading-relaxed text-ink/85">
        <input type="checkbox" name="consent" className="mt-1 h-4 w-4 shrink-0" />
        <span>
          I agree to the <a href="/terms-and-conditions" target="_blank" className="underline">Terms</a>, <a href="/privacy-policy" target="_blank" className="underline">Privacy Policy</a> and{" "}
          <a href="/refund-policy" target="_blank" className="underline">Refund Policy</a>.
        </span>
      </label>
      {errors.consent && <p className="text-sm text-danger">{errors.consent}</p>}
      {message && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{message}</div>}
      <button type="submit" disabled={busy} className="btn-primary w-full py-4 text-base">
        {busy ? "Please wait…" : `BUY NOW — ₹${price.toLocaleString("en-IN")}`}
      </button>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <IconShield width={16} className="mt-px shrink-0 text-gold-dark" />
        Your book is unlocked only after the payment is confirmed by the payment gateway. We never see or store your card, UPI PIN or bank details.
      </p>
    </form>
  );
}
