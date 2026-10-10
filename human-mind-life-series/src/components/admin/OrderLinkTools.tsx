"use client";

import { useActionState } from "react";
import { customerLinkAction, resendReadyEmailAction, type LinkState } from "@/app/admin/actions";

/** Admin tools that need a response shown once: a fresh customer link, and resending the "book ready" email. */
export function OrderLinkTools({ orderId, canEmail }: { orderId: number; canEmail: boolean }) {
  const [link, makeLink, linkPending] = useActionState<LinkState, FormData>(customerLinkAction, {});
  const [mail, resend, mailPending] = useActionState<LinkState, FormData>(resendReadyEmailAction, {});
  return (
    <div className="space-y-3">
      <form action={makeLink}>
        <input type="hidden" name="id" value={orderId} />
        <button className="btn-outline w-full" disabled={linkPending}>{linkPending ? "Creating…" : "Create customer status/download link"}</button>
      </form>
      {link.link && (
        <div className="rounded-lg bg-paper p-3 text-xs">
          <p className="font-semibold">Send this private link to the customer (shown once):</p>
          <p className="mt-1 font-mono break-all select-all">{link.link}</p>
        </div>
      )}
      {link.message && <p className="text-xs text-danger">{link.message}</p>}
      {canEmail && (
        <form action={resend}>
          <input type="hidden" name="id" value={orderId} />
          <button className="btn-outline w-full" disabled={mailPending}>{mailPending ? "Sending…" : "Resend “book ready” email"}</button>
        </form>
      )}
      {mail.message && <p className="text-xs text-muted">{mail.message}</p>}
    </div>
  );
}
