import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { amountMismatch, countOrdersByStatus, listOrders, orderAuthor } from "@/lib/server/orders";
import { ORDER_STATUSES, STATUS_LABELS, isOrderStatus } from "@/lib/order-status";
import { formatINR } from "@/lib/products";
import { formatDate, StatusBadge } from "@/components/admin/StatusBadge";

type Props = { searchParams: Promise<{ status?: string; q?: string }> };

export default async function AdminOrdersPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const status = isOrderStatus(sp.status) ? sp.status : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const orders = listOrders({ status, q: q || undefined });
  const counts = countOrdersByStatus();

  const tabs = [{ key: undefined, label: "All", n: counts.all }, ...ORDER_STATUSES.map((s) => ({ key: s, label: STATUS_LABELS[s], n: counts[s] }))];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Paid Orders</h1>
          <p className="mt-1 text-sm text-muted">Verify each payment in your bank / UPI app before changing its status.</p>
        </div>
        <a href="/api/admin/export" className="btn-outline px-4 py-2">Export CSV</a>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = t.key === status;
          const href = t.key ? `/admin?status=${t.key}` : "/admin";
          return (
            <Link
              key={t.label}
              href={href}
              className={`rounded-full px-4 py-2 text-sm font-medium ${active ? "bg-ink text-white" : "border border-line bg-white text-ink/75 hover:border-ink/30"}`}
            >
              {t.label} <span className={active ? "text-white/70" : "text-muted"}>({t.n})</span>
            </Link>
          );
        })}
      </div>

      <form className="mt-4 flex max-w-md gap-2" action="/admin">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Search name, email, phone, UTR or reference" className="input py-2" />
        <button className="btn-primary px-4 py-2">Search</button>
      </form>

      {orders.length === 0 ? (
        <div className="card mt-8 p-10 text-center text-muted">No orders found.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card mt-6 hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-paper text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Ref / Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Book</th>
                  <th className="px-4 py-3">Amount / Paid</th>
                  <th className="px-4 py-3">UTR</th>
                  <th className="px-4 py-3">Language / Delivery</th>
                  <th className="px-4 py-3">Screenshot</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => (
                  <tr key={o.id} className="align-top hover:bg-paper/60">
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold">{o.ref}</p>
                      <p className="text-xs text-muted">{formatDate(o.created_at)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{o.buyer_name}</p>
                      <p className="text-xs text-muted">{o.email}</p>
                      <p className="text-xs text-muted">+{o.whatsapp}</p>
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      {o.product_title}
                      <p className="text-xs text-muted">{orderAuthor(o)}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatINR(o.amount)}
                      {o.amount_paid != null && (
                        <p className={`text-xs ${amountMismatch(o) ? "font-semibold text-danger" : "text-muted"}`}>
                          Paid {formatINR(o.amount_paid)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{o.utr}</td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-semibold uppercase">{o.target_language}</p>
                      <p className="text-muted">{o.payment_status} · {o.fulfillment_status.replace("_", " ")}</p>
                      <p className="text-muted">{o.download_count} download{o.download_count === 1 ? "" : "s"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {o.screenshot_file ? (
                        <a href={`/api/admin/orders/${o.id}/screenshot`} target="_blank" className="text-gold-dark underline">View</a>
                      ) : (
                        <span className="text-xs text-muted">Gateway</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/orders/${o.id}`} className="btn-outline px-3 py-1.5 text-xs">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="mt-6 space-y-3 lg:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="card block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold">{o.ref}</p>
                      <p className="text-xs text-muted">{formatDate(o.created_at)}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-3 font-medium">{o.buyer_name}</p>
                  <p className="text-sm text-muted">{o.product_title} · {orderAuthor(o)}</p>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="font-mono text-xs">UTR {o.utr}</span>
                    <span className={`font-semibold ${amountMismatch(o) ? "text-danger" : ""}`}>
                      {formatINR(o.amount_paid ?? o.amount)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
