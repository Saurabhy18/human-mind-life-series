"use client";

import { useEffect } from "react";
import { trackPaymentSubmitted, type TrackedProduct } from "@/lib/analytics";

/** Fires the lead/conversion event once per order (not again on refresh). */
export function TrackSubmission({ product, orderRef }: { product: TrackedProduct; orderRef: string }) {
  useEffect(() => {
    const key = `hm_tracked_${orderRef}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        /* ignore */
      }
      trackPaymentSubmitted(product, orderRef);
    }, 800);
    return () => clearTimeout(t);
  }, [product, orderRef]);
  return null;
}
