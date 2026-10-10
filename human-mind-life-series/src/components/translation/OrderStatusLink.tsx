"use client";

import { TOKEN_RE, useUrlParam } from "./useUrlParam";

/** Reads the private order token from the URL fragment and links to the order's status/download page. */
export function OrderStatusLink({ orderRef }: { orderRef: string }) {
  const token = useUrlParam("t", "hash", TOKEN_RE);
  if (!token) return null;
  const href = `/order/status/${orderRef}#t=${token}`;
  return (
    <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-gold/30 bg-cream p-5 text-center">
      <a href={href} className="btn-primary w-full">Track your order &amp; download</a>
      <p className="mt-2 text-xs text-muted">Bookmark this personal link. Your book can be downloaded there once your payment is verified and the book is ready.</p>
    </div>
  );
}
