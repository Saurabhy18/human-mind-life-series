"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Cashfree } from "@cashfreepayments/cashfree-js";
import { formatMoney, type PurchaseSelection } from "@/config/packages";
import { getAttribution } from "@/lib/tracking-params";
import { useAuth } from "@/components/auth/AuthContext";
import { IconShield } from "../icons";

/** Browser-only key where the order's access token is kept across the full-page redirect to Cashfree
 * (the #t=… URL fragment is lost on redirect). Same-origin, per-tab, and NEVER sent to Cashfree. */
export const orderTokenKey = (orderId: string) => `hm:order-token:${orderId}`;

type Checkout = { provider: "cashfree"; mode: "sandbox" | "production"; paymentSessionId: string; orderRef: string; amount: number; currency: string };

/**
 * Payment-gateway checkout (only when PAYMENT_PROVIDER=cashfree).
 * Order (package + ebooks + languages; the server sets the price) → Cashfree hosted checkout →
 * the SERVER confirms payment (webhook / API) → order page.
 * The browser's "success" callback is never trusted: it only triggers a server-side check.
 */
export function GatewayCheckout({ selection, amount, currency }: { selection: PurchaseSelection; amount: number; currency: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.fullName && !customerName) setCustomerName(user.fullName);
      if (user.email && !customerEmail) setCustomerEmail(user.email);
    }
  }, [user]);


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
          packageId: selection.packageId,
          items: selection.items,
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
      const c = payJson.checkout;
      // Keep the access token so the status page can recover it after the redirect back from Cashfree.
      try {
        sessionStorage.setItem(orderTokenKey(order.orderId), order.accessToken);
      } catch {
        /* private mode / storage blocked — the #t= fragment still covers the common case */
      }

      // Load the Cashfree SDK, with a timeout so a blocked or slow SDK can never leave the button spinning.
      let cashfree: Cashfree | undefined;
      try {
        const { load } = await import("@cashfreepayments/cashfree-js");
        cashfree = await Promise.race([
          load({ mode: c.mode }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("sdk-load-timeout")), 15000)),
        ]);
      } catch {
        setMessage("We couldn't load the secure payment window. Check your connection (and disable any ad/tracker blocker for this site), then try again.");
        return;
      }
      if (!cashfree) {
        setMessage("We couldn't start the payment. Please try again.");
        return;
      }

      // Full-page redirect to Cashfree's hosted checkout — the most compatible option (no embedded iframe,
      // so modern-browser third-party-storage blocking can't stall it). On success the page navigates away
      // and Cashfree returns to the order status page, which verifies the payment SERVER-side. The browser
      // is never trusted to mark an order paid.
      try {
        // On success the page redirects to Cashfree and unloads, so this await never resolves. We race it
        // against a timeout so a stalled checkout can never leave the loading state (or the SDK overlay)
        // stuck forever — we surface an actionable error instead.
        const result = await Promise.race<{ error?: unknown } | void>([
          cashfree.checkout({ paymentSessionId: c.paymentSessionId, redirectTarget: "_self" }),
          new Promise<{ error: { message: string } }>((resolve) => setTimeout(() => resolve({ error: { message: "redirect-timeout" } }), 20000)),
        ]);
        if (result && (result as { error?: unknown }).error) {
          setMessage("The payment page didn't open. Please try again, or use a different browser — you have not been charged.");
        } else {
          router.push(statusPage);
        }
      } catch {
        setMessage("The payment window could not open. Please try again, or use a different browser.");
      }
    } catch {
      setMessage("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
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

      <div className="hidden" aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div>
        <label htmlFor="gw-name" className="label">Name *</label>
        <input
          id="gw-name"
          name="customerName"
          className="input"
          autoComplete="name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          required
          maxLength={80}
        />
        {errors.customerName && <p className="mt-1.5 text-sm text-danger">{errors.customerName}</p>}
      </div>
      <div>
        <label htmlFor="gw-email" className="label">Email *</label>
        <input
          id="gw-email"
          name="customerEmail"
          type="email"
          className="input"
          autoComplete="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          required
          maxLength={120}
          placeholder="you@example.com"
        />
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
        {busy ? "Please wait…" : `BUY NOW — ${formatMoney(amount, currency)}`}
      </button>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <IconShield width={16} className="mt-px shrink-0 text-gold-dark" />
        Your ebooks are unlocked only after the payment is confirmed by the payment gateway. We never see or store your card, UPI PIN or bank details.
      </p>
    </form>
  );
}
