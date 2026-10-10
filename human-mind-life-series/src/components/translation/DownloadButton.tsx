"use client";

import { useState } from "react";

/** Asks the server for a fresh short-lived signed URL for ONE ebook (only works for a paid, ready ebook) and starts the download. */
export function DownloadButton({ orderRef, itemId, token, remaining, onDone }: { orderRef: string; itemId: number; token: string; remaining: number; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function download() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/orders/${orderRef}/download?item=${itemId}`, { headers: { "x-order-token": token }, cache: "no-store" });
      const json = (await res.json()) as { success?: boolean; downloadUrl?: string; message?: string };
      if (res.ok && json.success && json.downloadUrl) {
        window.location.href = json.downloadUrl;
        onDone?.();
      } else {
        setMessage(json.message ?? "The download could not be started.");
      }
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={download} disabled={busy || remaining <= 0} className="btn-free w-full py-3 text-base">
        {busy ? "Preparing download…" : "Download PDF"}
      </button>
      {message && <p className="mt-2 text-sm text-danger">{message}</p>}
    </div>
  );
}
