"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatMoney } from "@/config/packages";
import { IconCheck, IconClock } from "../icons";
import { DownloadButton } from "./DownloadButton";
import { TOKEN_RE, useUrlParam } from "./useUrlParam";
import { orderTokenKey } from "../checkout/GatewayCheckout";

type Stage = "PAYMENT_PENDING" | "PAYMENT_FAILED" | "PAYMENT_SUCCESSFUL" | "PREPARING" | "TRANSLATING" | "GENERATING" | "READY" | "EXPIRED" | "FAILED" | "MANUAL_DELIVERY";

type Item = {
  itemId: number;
  title: string;
  volumeLabel: string | null;
  languageName: string;
  stage: Stage;
  progress: number;
  downloadsRemaining: number;
  accessExpiresAt: string | null;
};

type Status = {
  orderId: string;
  orderStatus?: string;
  paymentProvider?: string;
  packageName: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  stage: Stage;
  items: Item[];
};

const WORKING: Stage[] = ["PAYMENT_SUCCESSFUL", "PREPARING", "TRANSLATING", "GENERATING"];
const FINAL: Stage[] = ["READY", "EXPIRED", "PAYMENT_FAILED"];

/** Customer order page: polls GET /api/orders/:id/status and shows each ebook's progress, then its download button. */
export function TranslationProgress({ orderRef, gateway }: { orderRef: string; gateway: boolean }) {
  const fragmentToken = useUrlParam("t", "hash", TOKEN_RE);
  const [storedToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const t = sessionStorage.getItem(orderTokenKey(orderRef));
      return t && TOKEN_RE.test(t) ? t : null;
    } catch {
      return null;
    }
  });
  const token = fragmentToken ?? storedToken;
  const [status, setStatus] = useState<Status | null>(null);
  const statusRef = useRef<Status | null>(null);
  const [error, setError] = useState("");
  // Gateway payments are confirmed by re-asking Cashfree (server-side) until the order resolves.
  const paymentResolved = useRef(false); // true once the server reports PAID or FAILED
  const verifyTries = useRef(0); // bound how many times we re-poll Cashfree while still PENDING

  const load = useCallback(async () => {
    try {
      // While a gateway payment is still unresolved, re-ask the SERVER to confirm with Cashfree on each
      // poll (the webhook may be delayed, or — in local dev — unable to reach this machine). Once the
      // payment is PAID/FAILED, switch to the lighter status endpoint for fulfillment progress. The server
      // marks an order PAID only after Cashfree confirms it; the browser never decides.
      // Reverify with Cashfree gateway only if specifically a gateway order (not manual UPI) and not yet resolved
      const isGatewayOrder = statusRef.current ? statusRef.current.paymentProvider === "cashfree" : gateway;
      const reverify = isGatewayOrder && !paymentResolved.current && verifyTries.current < 6;
      if (reverify) verifyTries.current += 1;
      const url = reverify ? "/api/payment/verify" : `/api/orders/${orderRef}/status`;
      const headers: Record<string, string> = {};
      if (token) headers["x-order-token"] = token;
      if (reverify) headers["Content-Type"] = "application/json";

      const res = reverify
        ? await fetch(url, { method: "POST", headers, body: JSON.stringify({ orderId: orderRef }) })
        : await fetch(url, { headers, cache: "no-store" });
      const json = (await res.json()) as Status & { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        // If verify endpoint rate-limited or transient failure, fallback to status
        if (reverify) {
          verifyTries.current = 999;
          const fallbackRes = await fetch(`/api/orders/${orderRef}/status`, { headers: token ? { "x-order-token": token } : {}, cache: "no-store" });
          if (fallbackRes.ok) {
            const fallbackJson = (await fallbackRes.json()) as Status & { success?: boolean; message?: string };
            if (fallbackJson.success) {
              setError("");
              statusRef.current = fallbackJson;
              setStatus(fallbackJson);
              if (fallbackJson.paymentStatus === "PAID" || fallbackJson.orderStatus === "verified" || fallbackJson.orderStatus === "delivered" || fallbackJson.paymentStatus === "FAILED") {
                paymentResolved.current = true;
              }
              return;
            }
          }
        }
        setError(json.message ?? "We could not find this order.");
        return;
      }
      setError("");
      statusRef.current = json;
      setStatus(json);
      if (json.paymentStatus === "PAID" || json.orderStatus === "verified" || json.orderStatus === "delivered" || json.paymentStatus === "FAILED") {
        paymentResolved.current = true;
      }
    } catch {
      /* temporary network problem — keep polling */
    }
  }, [token, orderRef, gateway]);

  /** Manual "Check again": force a fresh Cashfree re-verification even after the automatic cap. */
  const recheck = useCallback(() => {
    if (!paymentResolved.current) verifyTries.current = 0;
    load();
  }, [load]);

  const isFinalRef = useRef(false);
  useEffect(() => {
    if (status && FINAL.includes(status.stage)) {
      isFinalRef.current = true;
    }
  }, [status]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(() => {
      if (!isFinalRef.current) {
        load();
      }
    }, 3000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  if (error) {
    return (
      <div className="card p-8 text-center space-y-4">
        <p className="text-xl font-serif text-ink">{error}</p>
        <p className="text-sm text-muted max-w-md mx-auto">
          If you placed this order while logged in, please make sure you are signed into your account. You can also view all your purchases directly under My Orders.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/orders" className="btn-primary px-5 py-2.5">Go to My Orders</Link>
          <Link href="/books" className="btn-outline px-5 py-2.5">Browse Books</Link>
          <Link href="/contact" className="btn-outline px-5 py-2.5">Contact Support</Link>
        </div>
      </div>
    );
  }
  if (!status) return <div className="card p-8 text-center text-muted">Loading your order…</div>;

  const paid = status.paymentStatus === "PAID" || status.orderStatus === "verified" || status.orderStatus === "delivered";
  const many = status.items.length > 1;
  const allReady = status.items.every((i) => i.stage === "READY");
  const working = status.items.some((i) => WORKING.includes(i.stage));

  return (
    <div className="card p-8 sm:p-10">
      <div className="text-center">
        <p className="text-sm text-muted">
          Order {status.orderId} · {status.packageName} · {formatMoney(status.amount, status.currency)}
        </p>
        {paid && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-1.5 text-sm font-semibold text-success">
            <IconCheck width={16} /> Payment Successful
          </p>
        )}
        <h2 className="mt-5 text-3xl">
          {status.stage === "PAYMENT_PENDING"
            ? "Payment Pending"
            : status.stage === "PAYMENT_FAILED"
              ? "Payment Failed"
              : allReady
                ? `Payment Successful! Your ${many ? "eBooks are" : "eBook is"} Ready to Download`
                : "Thank you for your purchase."}
        </h2>

        {status.stage === "PAYMENT_PENDING" && (
          <div className="mx-auto mt-4 max-w-md">
            <p className="text-muted">
              {gateway ? "We are waiting for confirmation from the payment gateway." : "Your payment is being verified."} This page checks automatically. If you have just completed payment, it can take a few moments.
            </p>
            {gateway && (
              <button type="button" onClick={recheck} className="btn-outline mt-4 text-sm">
                Check payment status again
              </button>
            )}
          </div>
        )}
        {status.stage === "PAYMENT_FAILED" && <p className="mx-auto mt-4 max-w-md text-muted">Payment could not be completed. Please try again. No ebook has been issued.</p>}
        {paid && working && <p className="mx-auto mt-4 max-w-md text-muted">Your {many ? "ebooks are" : "ebook is"} being prepared. You can download each one as soon as it is ready.</p>}
      </div>

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {status.items.map((item) => (
          <li key={item.itemId} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              {item.volumeLabel && <p className="eyebrow">{item.volumeLabel}</p>}
              <p className="font-serif text-lg leading-snug">
                {item.title} <span className="text-muted">— {item.languageName}</span>
              </p>
              {paid && <ItemState item={item} />}
            </div>
            {paid && item.stage === "READY" && (
              <div className="sm:w-56">
                <DownloadButton orderRef={status.orderId} itemId={item.itemId} token={token} remaining={item.downloadsRemaining} onDone={load} />
                {item.accessExpiresAt && (
                  <p className="mt-2 text-center text-xs text-muted">
                    Until {new Date(item.accessExpiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {item.downloadsRemaining} download(s) left
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {paid && working && (
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-sm text-muted">
          <IconClock width={16} /> Download each ebook here as soon as it is ready. If you close this page, we will also email you a recovery link.
        </p>
      )}

      <div className="mt-8 pt-6 border-t border-line flex flex-wrap items-center justify-center gap-3">
        <Link href="/orders" className="btn-primary px-5 py-2.5 text-center">
          Go to My Orders
        </Link>
        <Link href="/books" className="btn-outline px-5 py-2.5 text-center">
          Browse Books
        </Link>
        <Link href="/" className="btn-outline px-5 py-2.5 text-center">
          Home
        </Link>
      </div>
    </div>
  );
}

/** One ebook's status: ✓ Ready · ⏳ Preparing · ⏳ Processing (with progress) · Failed · manual delivery · expired. */
function ItemState({ item }: { item: Item }) {
  if (item.stage === "READY") {
    return (
      <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-success">
        <IconCheck width={14} /> Ready
      </p>
    );
  }
  if (WORKING.includes(item.stage)) {
    const processing = item.stage === "TRANSLATING" || item.stage === "GENERATING";
    const blocks = 20;
    const filled = Math.round((item.progress / 100) * blocks);
    return (
      <div className="mt-1 text-sm text-muted">
        <p className="inline-flex items-center gap-1.5 font-semibold text-gold-dark">
          <IconClock width={14} /> {processing ? "Processing" : "Preparing"}…
        </p>
        <p className="mt-0.5">Your selected-language ebook is being prepared.</p>
        {processing && (
          <>
            <p className="mt-1 font-mono tracking-tight text-gold-dark" aria-hidden="true">
              {"█".repeat(filled)}
              <span className="text-line">{"░".repeat(blocks - filled)}</span> <span className="text-ink">{item.progress}%</span>
            </p>
            <div className="sr-only" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100} />
          </>
        )}
      </div>
    );
  }
  if (item.stage === "FAILED") return <p className="mt-1 text-sm text-danger">We could not prepare this language version yet. Please try again later — our team has been notified, and you don&apos;t need to pay again.</p>;
  if (item.stage === "MANUAL_DELIVERY") return <p className="mt-1 text-sm text-muted">This ebook is being finalized for download. We will make it available here and notify you by email shortly.</p>;
  if (item.stage === "EXPIRED") return <p className="mt-1 text-sm text-muted">The download period for this ebook has ended. Please contact us with your order reference and we will help.</p>;
  return null;
}
