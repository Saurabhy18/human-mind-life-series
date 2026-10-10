import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CONFIG } from "@/config/site.config";
import { requireAdmin } from "@/lib/server/auth";
import { PRIVATE_BOOKS_DIR } from "@/lib/server/db";
import { getFreeRequest } from "@/lib/server/free-requests";
import { FREE_STATUSES, FREE_STATUS_LABELS } from "@/lib/free-status";
import { mailtoLink, whatsappLink } from "@/lib/contact";
import { formatDate } from "@/components/admin/StatusBadge";
import { FreeStatusBadge } from "@/components/admin/FreeStatusBadge";
import { updateFreeStatusAction } from "../../../actions";

type Props = { params: Promise<{ id: string }> };

export default async function AdminFreeRequestPage({ params }: Props) {
  await requireAdmin();
  const id = Number((await params).id);
  const request = Number.isInteger(id) ? getFreeRequest(id) : undefined;
  if (!request) notFound();

  const utm = request.utm_json ? (JSON.parse(request.utm_json) as Record<string, string>) : null;
  const pdfAvailable = fs.existsSync(path.join(/*turbopackIgnore: true*/ PRIVATE_BOOKS_DIR, `${request.book_slug}.pdf`));
  const message = `Hello ${request.name},\n\nThank you for requesting your free copy of "${request.book_title}" (request ${request.ref}). Please find the book attached.\n\nThis copy is for your personal use only. Please do not share or distribute it.\n\nHappy reading!\n${CONFIG.SITE_NAME}`;
  const mailDeliver = mailtoLink(request.email, `Your free book: ${request.book_title} (${request.ref})`, message);
  const waDeliver = request.whatsapp ? whatsappLink(message, request.whatsapp) : null;
  const linkExpired = request.download_expires_at ? new Date(request.download_expires_at.replace(" ", "T") + "Z") < new Date() : false;

  return (
    <>
      <Link href="/admin/free-requests" className="text-sm text-muted hover:text-ink">← All free requests</Link>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="font-mono text-3xl">{request.ref}</h1>
        <FreeStatusBadge status={request.status} />
        <span className="free-badge">Free Book Request</span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card h-fit p-6">
          <h2 className="text-xl">Request details</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <Item label="Name" value={request.name} />
            <Item label="Email" value={<a className="underline" href={`mailto:${request.email}`}>{request.email}</a>} />
            <Item
              label="WhatsApp"
              value={
                request.whatsapp ? (
                  <a className="underline" href={whatsappLink(undefined, request.whatsapp) ?? "#"} target="_blank" rel="noopener noreferrer">+{request.whatsapp}</a>
                ) : (
                  "Not provided"
                )
              }
            />
            <Item label="Book" value={request.book_title} />
            <Item label="Author" value={request.author ?? "—"} />
            <Item label="Price" value={<strong className="text-success">FREE (₹0)</strong>} />
            <Item label="Request date" value={formatDate(request.created_at)} />
            <Item label="Delivery status" value={FREE_STATUS_LABELS[request.status]} />
            <Item label="Book sent" value={formatDate(request.sent_at)} />
            <Item label="Completed" value={formatDate(request.completed_at)} />
            <Item
              label="Personal download link"
              value={
                request.download_token_hash
                  ? `Used ${request.download_count} of ${CONFIG.FREE_DOWNLOAD_LIMIT} · ${linkExpired ? "expired" : `valid until ${formatDate(request.download_expires_at)}`}`
                  : "Not issued (manual delivery)"
              }
            />
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

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-xl">Update delivery status</h2>
            <form action={updateFreeStatusAction} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={request.id} />
              <div>
                <label htmlFor="status" className="label">Status</label>
                <select id="status" name="status" defaultValue={request.status} className="input">
                  {FREE_STATUSES.map((s) => (
                    <option key={s} value={s}>{FREE_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="note" className="label">Internal note (optional)</label>
                <textarea id="note" name="note" rows={3} className="input" defaultValue="" />
                {request.admin_note && <p className="mt-1 text-xs text-muted">Current note: {request.admin_note}</p>}
              </div>
              <button className="btn-primary w-full">Save status</button>
            </form>
          </section>

          <section className="card p-6">
            <h2 className="text-xl">Send the free book</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Download the PDF and send it by email or WhatsApp (message is pre-written).</li>
              <li>Set status to <strong>Free Book Sent</strong>, then <strong>Completed</strong>.</li>
            </ol>
            <div className="mt-5 space-y-3">
              {pdfAvailable ? (
                <a href={`/api/admin/books/${request.book_slug}/pdf`} className="btn-outline w-full">Download PDF</a>
              ) : (
                <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                  No PDF found at <code>storage/books/{request.book_slug}.pdf</code>. Upload it there on the server (it stays private).
                </p>
              )}
              {mailDeliver && <a href={mailDeliver} className="btn-outline w-full">Open delivery email</a>}
              {waDeliver && <a href={waDeliver} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">Open WhatsApp chat</a>}
            </div>
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
