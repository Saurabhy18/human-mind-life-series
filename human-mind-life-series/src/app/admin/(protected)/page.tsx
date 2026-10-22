import Link from "next/link";
import {
  BadgeCheck,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Image as ImageIcon,
  Inbox,
  PackageCheck,
  Search,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { requireAdmin } from "@/lib/server/auth";
import { amountMismatch, countOrdersByStatus, itemsForOrders, listOrders, orderAuthor } from "@/lib/server/orders";
import { ORDER_STATUSES, STATUS_LABELS, isOrderStatus, type OrderStatus } from "@/lib/order-status";
import { formatINR } from "@/lib/products";
import { formatDate, StatusBadge } from "@/components/admin/StatusBadge";

type Props = { searchParams: Promise<{ status?: string; q?: string }> };

const TAB_STYLE: Record<OrderStatus | "all", { Icon: LucideIcon; tone: string; ring: string }> = {
  all: { Icon: Inbox, tone: "bg-ink/10 text-ink", ring: "ring-ink" },
  pending: { Icon: Clock, tone: "bg-amber-100 text-amber-700", ring: "ring-amber-400" },
  verified: { Icon: BadgeCheck, tone: "bg-sky-100 text-sky-700", ring: "ring-sky-400" },
  rejected: { Icon: XCircle, tone: "bg-red-100 text-red-700", ring: "ring-red-400" },
  delivered: { Icon: PackageCheck, tone: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-400" },
};

const PAYMENT_CHIP: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  FAILED: "bg-red-50 text-red-700",
  REFUNDED: "bg-slate-100 text-slate-600",
};

const FULFILLMENT_CHIP: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700",
  PROCESSING: "bg-sky-50 text-sky-700",
  NOT_STARTED: "bg-slate-100 text-slate-600",
  FAILED: "bg-red-50 text-red-700",
};

const chip = "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide whitespace-nowrap uppercase";

export default async function AdminOrdersPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const status = isOrderStatus(sp.status) ? sp.status : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";

  let orders: any[] = [];
  let items = new Map<number, any[]>();
  let counts = { all: 0, pending: 0, verified: 0, rejected: 0, delivered: 0 };
  let fetchError = "";

  try {
    orders = listOrders({ status, q: q || undefined });
    items = itemsForOrders(orders.map((o) => o.id));
    counts = countOrdersByStatus();
  } catch (err: any) {
    console.error("AdminOrdersPage query error:", err);
    fetchError = err?.message || String(err);
  }

  const languages = (id: number) => [...new Set((items.get(id) ?? []).map((i) => i.target_language))].join(", ");
  const tabs = [
    { key: undefined, style: TAB_STYLE.all, label: "All Orders", n: counts.all },
    ...ORDER_STATUSES.map((s) => ({ key: s, style: TAB_STYLE[s], label: STATUS_LABELS[s], n: counts[s] })),
  ];

  return (
    <>
      {fetchError && (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          <strong>Database query notice:</strong> {fetchError}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-gold-dark uppercase">Order Management</p>
          <h1 className="mt-1 font-serif text-3xl font-medium text-ink">Paid Orders</h1>
          <p className="mt-1 text-sm text-muted">Verify each payment in your bank / UPI app before changing its status.</p>
        </div>
        <a
          href="/api/admin/export"
          className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 transition hover:border-emerald-600 hover:bg-emerald-600 hover:text-white"
        >
          <Download size={16} />
          Export CSV
        </a>
      </div>

      {/* Stat cards double as status filters */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tabs.map(({ key, style: { Icon, tone, ring }, label, n }) => {
          const active = key === status;
          return (
            <Link
              key={label}
              href={key ? `/admin?status=${key}` : "/admin"}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-2xl border bg-white p-4 transition hover:shadow-md ${
                active ? `border-transparent ring-2 ${ring} shadow-sm` : "border-line"
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <Icon size={19} />
              </span>
              <span className="min-w-0">
                <span className="block text-2xl font-semibold leading-none text-ink">{n}</span>
                <span className="mt-1 block truncate text-[0.7rem] font-medium tracking-wide text-muted uppercase">{label}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <form className="mt-5 flex max-w-lg gap-2" action="/admin">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Search name, email, phone, UTR or reference" className="input py-2 pl-9" />
        </div>
        <button className="btn-primary px-5 py-2 text-sm">Search</button>
      </form>

      {orders.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center gap-2 p-12 text-center text-muted">
          <Inbox size={32} className="text-line" />
          No orders found.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card mt-6 hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-cream/60 text-[0.7rem] font-semibold tracking-wider text-ink/60 uppercase">
                  <tr>
                    <th className="px-4 py-3.5">Order</th>
                    <th className="px-4 py-3.5">Customer</th>
                    <th className="px-4 py-3.5">Books</th>
                    <th className="px-4 py-3.5 text-right">Amount</th>
                    <th className="px-4 py-3.5">Payment</th>
                    <th className="px-4 py-3.5">Delivery</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {orders.map((o) => (
                    <tr key={o.id} className="align-middle transition-colors hover:bg-gold/5">
                      {/* Order ref + date */}
                      <td className="whitespace-nowrap px-4 py-4">
                        <p className="font-mono text-[0.8rem] font-semibold text-ink">{o.ref}</p>
                        <p className="mt-0.5 text-xs text-muted">{formatDate(o.created_at)}</p>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 font-serif text-sm font-semibold text-gold-dark uppercase">
                            {(o.buyer_name || o.email || "?").charAt(0)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{o.buyer_name}</p>
                            <p className="max-w-[190px] truncate text-xs text-muted" title={o.email}>{o.email}</p>
                            {o.whatsapp && <p className="text-xs text-muted">+{o.whatsapp}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Books */}
                      <td className="max-w-[230px] px-4 py-4">
                        <p className="line-clamp-2 font-medium leading-snug text-ink" title={o.product_title}>{o.product_title}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted">{orderAuthor(o)}</p>
                      </td>

                      {/* Amount */}
                      <td className="whitespace-nowrap px-4 py-4 text-right">
                        <p className="font-semibold text-ink">{formatINR(o.amount)}</p>
                        {o.amount_paid != null && (
                          <p className={`text-xs ${amountMismatch(o) ? "font-semibold text-danger" : "text-emerald-700"}`}>
                            Paid {formatINR(o.amount_paid)}
                          </p>
                        )}
                      </td>

                      {/* Payment: UTR + proof */}
                      <td className="px-4 py-4">
                        <p className="max-w-[150px] truncate font-mono text-xs text-ink/80" title={o.utr}>{o.utr || "—"}</p>
                        <div className="mt-1.5">
                          {o.screenshot_file ? (
                            <a
                              href={`/api/admin/orders/${o.id}/screenshot`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 transition hover:bg-violet-600 hover:text-white"
                            >
                              <ImageIcon size={12} />
                              Screenshot
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              <CreditCard size={12} />
                              Gateway
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Delivery */}
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`${chip} bg-ink text-white`}>{languages(o.id) || o.target_language}</span>
                          <span className={`${chip} ${PAYMENT_CHIP[o.payment_status] ?? PAYMENT_CHIP.PENDING}`}>{o.payment_status}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`${chip} ${FULFILLMENT_CHIP[o.fulfillment_status] ?? FULFILLMENT_CHIP.NOT_STARTED}`}>
                            {String(o.fulfillment_status).replace("_", " ")}
                          </span>
                          <span className="whitespace-nowrap text-xs text-muted">
                            {o.download_count} ↓
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4"><StatusBadge status={o.status} /></td>

                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gold-dark"
                        >
                          Open
                          <ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <ul className="mt-6 space-y-3 lg:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="card block p-4 transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold">{o.ref}</p>
                      <p className="text-xs text-muted">{formatDate(o.created_at)}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-3 font-medium">{o.buyer_name}</p>
                  <p className="text-sm text-muted">{o.product_title} · {orderAuthor(o)} · <span className="uppercase">{languages(o.id)}</span></p>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
                    <span className="max-w-[60%] truncate font-mono text-xs text-muted">UTR {o.utr}</span>
                    <span className={`font-semibold ${amountMismatch(o) ? "text-danger" : "text-ink"}`}>
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
