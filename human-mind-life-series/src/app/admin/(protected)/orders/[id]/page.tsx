import Link from "next/link";
import { notFound } from "next/navigation";
import { CONFIG } from "@/config/site.config";
import { requireAdmin } from "@/lib/server/auth";
import { amountMismatch, getOrder, getOrderEvents, getOrderItems, orderAuthor } from "@/lib/server/orders";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/order-status";
import { getPackage } from "@/config/packages";
import { formatINR } from "@/lib/products";
import { mailtoLink, whatsappLink } from "@/lib/contact";
import { formatDate, StatusBadge } from "@/components/admin/StatusBadge";
import { restartFulfillmentAction, retryTranslationAction, updateStatusAction } from "../../../actions";
import { orderDownloads, orderJob } from "@/lib/server/adminReports";
import { OrderLinkTools } from "@/components/admin/OrderLinkTools";
import { isBookSourceAvailable } from "@/lib/server/translation/bookSource";

type Props = { params: Promise<{ id: string }> };

export default async function AdminOrderPage({ params }: Props) {
  await requireAdmin();
  const order = getOrder(Number((await params).id));
  if (!order) notFound();

  const events = getOrderEvents(order.id);
  const rawItems = getOrderItems(order.id);
  const items = rawItems.map((i) => ({ ...i, job: orderJob(i.cache_key), pdfAvailable: isBookSourceAvailable(i.book_slug) }));
  const downloads = orderDownloads(order.id);
  const utm = order.utm_json ? (JSON.parse(order.utm_json) as Record<string, string>) : null;
  const bookList = items.map((i) => `- ${i.book_title} (${i.target_language})`).join("\n");

  const deliveryMessage = `Hello ${order.buyer_name},\n\nThank you for your purchase! Your payment for order ${order.ref} has been verified. Please find your ${items.length > 1 ? "ebooks" : "ebook"} attached:\n${bookList}\n\nThis copy is for your personal use only. Please do not share or distribute it.\n\nHappy reading!\n${CONFIG.SITE_NAME}`;
  const rejectMessage = `Hello ${order.buyer_name},\n\nWe were unable to verify your payment for "${order.product_title}" (order ${order.ref}, UTR ${order.utr}). Please reply with your payment details so we can check again.\n\n${CONFIG.SITE_NAME}`;

  const waDeliver = whatsappLink(deliveryMessage, order.whatsapp);
  const mailDeliver = mailtoLink(order.email, `Your book: ${order.product_title} (${order.ref})`, deliveryMessage);
  const waReject = whatsappLink(rejectMessage, order.whatsapp);
  const mailReject = mailtoLink(order.email, `About your order ${order.ref}`, rejectMessage);

  return (
    <>
      <Link href="/admin" className="text-sm text-muted hover:text-ink">← All orders</Link>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="font-mono text-3xl">{order.ref}</h1>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <section className="card p-4 sm:p-5">
            <h2 className="text-xl">Order details</h2>
            <dl className="mt-3 grid gap-x-4 gap-y-2.5 text-xs sm:grid-cols-2">
              <Item label="Customer name" value={order.buyer_name} />
              <Item label="Email" value={<a className="underline" href={`mailto:${order.email}`}>{order.email}</a>} />
              <Item label="WhatsApp" value={<a className="underline" href={whatsappLink(undefined, order.whatsapp) ?? "#"} target="_blank" rel="noopener noreferrer">+{order.whatsapp}</a>} />
              <Item label="Package" value={getPackage(order.package_type)?.name ?? order.package_type} />
              <Item label="Book(s) purchased" value={order.product_title} />
              <Item label="Author" value={orderAuthor(order) || "—"} />
              <Item label="Amount (expected)" value={<strong>{formatINR(order.amount)}</strong>} />
              <Item
                label="Amount paid (entered by customer)"
                value={
                  order.amount_paid == null ? (
                    "—"
                  ) : (
                    <strong className={amountMismatch(order) ? "text-danger" : undefined}>
                      {formatINR(order.amount_paid)}
                      {amountMismatch(order) && " — does not match the price"}
                    </strong>
                  )
                }
              />
              <Item label="UTR / Transaction ID" value={<span className="font-mono">{order.utr}</span>} />
              <Item label="Submitted" value={formatDate(order.created_at)} />
              <Item label="Verified" value={formatDate(order.verified_at)} />
              <Item label="Delivered" value={formatDate(order.delivered_at)} />
              <Item label="Order status" value={STATUS_LABELS[order.status]} />
            </dl>
            {utm && (
              <div className="mt-6 border-t border-line pt-4">
                <h3 className="text-sm font-semibold">Marketing source</h3>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  {Object.entries(utm).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="text-muted">{k}:</dt>
                      <dd className="break-all">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </section>

          {order.screenshot_file && (
          <section className="card p-4 sm:p-5">
            <h2 className="text-xl">Payment screenshot</h2>
            <p className="mt-1 text-sm text-muted">Compare the amount, UTR and date with your bank / UPI app statement — screenshots can be edited.</p>
            <a href={`/api/admin/orders/${order.id}/screenshot`} target="_blank" className="mt-4 block">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-protected image */}
              <img src={`/api/admin/orders/${order.id}/screenshot`} alt={`Payment screenshot for ${order.ref}`} className="max-h-[520px] rounded-xl border border-line object-contain" />
            </a>
          </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="card p-4 sm:p-5">
            <h2 className="text-xl">Ebooks, languages &amp; delivery</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Item label="Payment" value={`${order.payment_status} (${order.payment_provider})`} />
              <Item label="Delivery (overall)" value={order.fulfillment_status.replace("_", " ")} />
            </dl>
            <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
              {items.map((i) => (
                <li key={i.id} className="py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{i.book_title}</span>
                    <span className="font-mono text-xs">{i.source_language} → {i.target_language}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {i.fulfillment_status.replace("_", " ")}
                    {i.job && ` · job ${i.job.status}${i.job.phase ? ` ${i.job.phase}` : ""} ${i.job.progress}% · ${i.job.attempts} attempt(s)`} · {i.download_count} download(s)
                    {i.access_expires_at && ` · access until ${formatDate(i.access_expires_at)}`}
                    {i.translated_book_id && (
                      <>
                        {" · "}
                        <a className="text-gold-dark underline" href={`/api/admin/translations/${i.translated_book_id}/file`}>Delivered PDF</a>
                      </>
                    )}
                  </p>
                  {i.job?.last_error && i.job.status !== "COMPLETED" && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">{i.job.last_error}</p>}
                  {i.job?.status === "FAILED" && (
                    <form action={retryTranslationAction} className="mt-2">
                      <input type="hidden" name="jobId" value={i.job.id} />
                      <button className="btn-outline px-3 py-1.5 text-xs">Retry translation</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-3">
              {order.payment_status === "PAID" && items.some((i) => i.fulfillment_status === "NOT_STARTED" || i.fulfillment_status === "FAILED") && (
                <form action={restartFulfillmentAction}>
                  <input type="hidden" name="id" value={order.id} />
                  <button className="btn-outline w-full">{items.some((i) => i.fulfillment_status === "FAILED") ? "Retry automatic delivery" : "Start automatic delivery"}</button>
                  <p className="mt-1 text-xs text-muted">Uses the PDFs currently in storage/books/ (e.g. after uploading a missing or corrected source PDF).</p>
                </form>
              )}
              <OrderLinkTools orderId={order.id} canEmail={items.some((i) => i.fulfillment_status === "COMPLETED")} />
            </div>
            {downloads.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-muted">
                {downloads.map((d, i) => (
                  <li key={i}>
                    {d.event}
                    {d.book_title && ` · ${d.book_title} (${d.target_language})`} · {formatDate(d.created_at)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4 sm:p-5">
            <h2 className="text-xl">Update status</h2>
            <form action={updateStatusAction} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={order.id} />
              <div>
                <label htmlFor="status" className="label">Status</label>
                <select id="status" name="status" defaultValue={order.status} className="input">
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="note" className="label">Internal note (optional)</label>
                <textarea id="note" name="note" rows={3} className="input" placeholder="e.g. Verified in HDFC statement" defaultValue="" />
                {order.admin_note && <p className="mt-1 text-xs text-muted">Current note: {order.admin_note}</p>}
              </div>
              <button className="btn-primary w-full">Save status</button>
            </form>
          </section>

          <section className="card p-4 sm:p-5">
            <h2 className="text-xl">Deliver the {items.length > 1 ? "ebooks" : "book"}</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Confirm the payment and set status to <strong>Payment Verified</strong>. Ebooks with a source PDF are then delivered automatically.</li>
              <li>For any ebook still shown as <strong>NOT STARTED</strong>, download the PDF and send it by email or WhatsApp (message is pre-written).</li>
              <li>Set status to <strong>Book Delivered</strong>.</li>
            </ol>
            <div className="mt-5 space-y-3">
              {items.map((i) =>
                i.pdfAvailable ? (
                  <a key={i.id} href={`/api/admin/books/${i.book_slug}/pdf`} className="btn-outline w-full">
                    Download English PDF — {i.book_title}
                  </a>
                ) : (
                  <p key={i.id} className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                    No PDF found at <code>storage/books/{i.book_slug}.pdf</code>. Upload it there on the server (it stays private), or attach it from your computer.
                  </p>
                ),
              )}
              {mailDeliver && <a href={mailDeliver} className="btn-outline w-full">Open delivery email</a>}
              {waDeliver && <a href={waDeliver} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">Open WhatsApp chat</a>}
            </div>
            <div className="mt-6 border-t border-line pt-4">
              <p className="text-sm font-medium">Payment problem?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {mailReject && <a href={mailReject} className="text-sm text-gold-dark underline">Email customer</a>}
                {waReject && <a href={waReject} target="_blank" rel="noopener noreferrer" className="text-sm text-gold-dark underline">WhatsApp customer</a>}
              </div>
            </div>
          </section>

          <section className="card p-4 sm:p-5">
            <h2 className="text-xl">History</h2>
            <ol className="mt-4 space-y-3 text-sm">
              {events.map((e) => (
                <li key={e.id} className="border-l-2 border-gold/40 pl-3">
                  <p className="font-medium">{STATUS_LABELS[e.status as keyof typeof STATUS_LABELS] ?? e.status}</p>
                  <p className="text-xs text-muted">{formatDate(e.created_at)}</p>
                  {e.note && <p className="mt-1 text-ink/75">{e.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words">{value}</dd>
    </div>
  );
}
