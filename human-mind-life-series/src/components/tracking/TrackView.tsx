"use client";

import { useEffect } from "react";
import { trackBeginCheckout, trackViewItem, type TrackedProduct } from "@/lib/analytics";

/** Drop into a page to fire a funnel event once when it is viewed. */
export function TrackView({ event, product }: { event: "view_item" | "begin_checkout"; product: TrackedProduct }) {
  useEffect(() => {
    // Wait briefly so the tracking scripts have initialised.
    const t = setTimeout(() => {
      if (event === "view_item") trackViewItem(product);
      else trackBeginCheckout(product);
    }, 600);
    return () => clearTimeout(t);
  }, [event, product]);
  return null;
}
