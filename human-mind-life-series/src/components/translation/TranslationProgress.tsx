"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck, IconClock } from "../icons";
import { DownloadButton } from "./DownloadButton";
import { TOKEN_RE, useUrlParam } from "./useUrlParam";

type Status = {
  orderId: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  stage: "PAYMENT_PENDING" | "PAYMENT_FAILED" | "PAYMENT_SUCCESSFUL" | "PREPARING" | "TRANSLATING" | "GENERATING" | "READY" | "EXPIRED" | "FAILED" | "MANUAL_DELIVERY";
  progress: number;
  targetLanguage: string;
  downloadsRemaining: number;
  accessExpiresAt: string | null;
};

const LABEL: Record<Status["stage"], string> = {
  PAYMENT_PENDING: "Payment Pending",
  PAYMENT_FAILED: "Payment Failed",
  PAYMENT_SUCCESSFUL: "Payment Successful",
  PREPARING: "Preparing Your Book",
  TRANSLATING: "Translating",
  GENERATING: "Generating Book",
  READY: "Ready for Download",
  EXPIRED: "Download Period Ended",
  FAILED: "Failed",
  MANUAL_DELIVERY: "Payment Successful",
};

/** Customer order page: polls GET /api/orders/:id/status and shows progress, then the download button. */
export function TranslationProgress({ orderRef, gateway }: { orderRef: string; gateway: boolean }) {
  const token = useUrlParam("t", "hash", TOKEN_RE);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [languageName, setLanguageName] = useState<string>("");
  const verified = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(t);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      // After returning from the gateway, ask the SERVER to confirm with the gateway once.
      const url = gateway && !verified.current ? "/api/payment/verify" : `/api/orders/${orderRef}/status`;
      const res =
        url === "/api/payment/verify"
          ? await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-order-token": token }, body: JSON.stringify({ orderId: orderRef }) })
          : await fetch(url, { headers: { "x-order-token": token }, cache: "no-store" });
      verified.current = true;
      const json = (await res.json()) as Status & { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        setError(json.message ?? "We could not find this order.");
        return;
      }
      setError("");
      setStatus(json);
    } catch {
      /* temporary network problem — keep polling */
    }
  }, [token, orderRef, gateway]);

  useEffect(() => {
    if (!token) return;
    const first = setTimeout(load, 0);
    const id = setInterval(() => {
      setStatus((s) => {
        if (!s || !["READY", "EXPIRED", "FAILED", "PAYMENT_FAILED", "MANUAL_DELIVERY"].includes(s.stage)) load();
        return s;
      });
    }, 4000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [token, load]);

  useEffect(() => {
    if (!status) return;
    fetch("/api/languages")
      .then((r) => r.json())
      .then((d: { languages?: { code: string; name: string }[] }) => setLanguageName(d.languages?.find((l) => l.code === status.targetLanguage)?.name ?? status.targetLanguage))
      .catch(() => setLanguageName(status.targetLanguage));
  }, [status?.targetLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (hydrated && !token && !error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-lg">This link is incomplete. Please open the link from your email or the confirmation page.</p>
        <Link href="/contact" className="btn-outline mt-6">Contact us</Link>
      </div>
    );
  }
  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-lg">{error}</p>
        <Link href="/contact" className="btn-outline mt-6">Contact us</Link>
      </div>
    );
  }
  if (!status) return <div className="card p-8 text-center text-muted">Loading your order…</div>;

  const lang = languageName || status.targetLanguage;
  const working = ["PAYMENT_SUCCESSFUL", "PREPARING", "TRANSLATING", "GENERATING"].includes(status.stage);
  const blocks = 20;
  const filled = Math.round((status.progress / 100) * blocks);

  return (
    <div className="card p-8 text-center sm:p-10">
      <p className="text-sm text-muted">Order {status.orderId}</p>
      {status.paymentStatus === "PAID" && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-1.5 text-sm font-semibold text-success">
          <IconCheck width={16} /> Payment Successful
        </p>
      )}
      <h2 className="mt-5 text-3xl">
        {status.stage === "READY" ? "Your book is ready! ✓" : LABEL[status.stage]}
      </h2>

      {status.stage === "PAYMENT_PENDING" && (
        <p className="mx-auto mt-4 max-w-md text-muted">
          {gateway ? "We are waiting for confirmation from the payment gateway. This page updates automatically." : "Your payment is being verified manually. This page updates automatically once it is confirmed."}
        </p>
      )}
      {status.stage === "PAYMENT_FAILED" && <p className="mx-auto mt-4 max-w-md text-muted">The payment could not be completed. No book has been issued. Please try again or contact us.</p>}
      {status.stage === "MANUAL_DELIVERY" && <p className="mx-auto mt-4 max-w-md text-muted">Your payment is confirmed. Your book will be sent to your email / WhatsApp.</p>}

      {working && (
        <div className="mx-auto mt-6 max-w-md">
          <p className="text-muted">Your {lang} book is being prepared.</p>
          <p className="mt-5 text-sm font-medium">Translation Progress</p>
          <div className="mt-2 font-mono text-lg tracking-tight text-gold-dark" aria-hidden="true">
            {"█".repeat(filled)}
            <span className="text-line">{"░".repeat(blocks - filled)}</span> <span className="text-ink">{status.progress}%</span>
          </div>
          <div className="sr-only" role="progressbar" aria-valuenow={status.progress} aria-valuemin={0} aria-valuemax={100} />
          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted">
            <IconClock width={16} /> Please wait… you can also close this page — we will email you when it&apos;s ready.
          </p>
        </div>
      )}

      {status.stage === "READY" && token && (
        <div className="mx-auto mt-6 max-w-sm">
          <p className="text-muted">Language: <strong className="text-ink">{lang}</strong></p>
          <DownloadButton orderRef={status.orderId} token={token} remaining={status.downloadsRemaining} onDone={load} />
          {status.accessExpiresAt && (
            <p className="mt-3 text-xs text-muted">
              Download link expires {new Date(status.accessExpiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {status.downloadsRemaining} download(s) left
            </p>
          )}
        </div>
      )}
      {status.stage === "EXPIRED" && <p className="mx-auto mt-4 max-w-md text-muted">The download period for this order has ended. Please contact us with your order reference and we will help.</p>}
      {status.stage === "FAILED" && (
        <p className="mx-auto mt-4 max-w-md text-muted">We were unable to prepare your book. Our team has been notified and will retry — you don&apos;t need to pay again.</p>
      )}
    </div>
  );
}
