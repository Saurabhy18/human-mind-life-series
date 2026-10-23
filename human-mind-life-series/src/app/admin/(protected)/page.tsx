import Link from "next/link";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Image as ImageIcon,
  Inbox,
  PackageCheck,
  Search,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { requireAdmin } from "@/lib/server/auth";
import {
  amountMismatch,
  countFilteredOrders,
  countOrdersByStatus,
  itemsForOrders,
  listOrders,
  orderAuthor,
  type Order,
  type OrderItem,
} from "@/lib/server/orders";
import { ORDER_STATUSES, STATUS_LABELS, isOrderStatus, type OrderStatus } from "@/lib/order-status";
import { formatINR } from "@/lib/products";
import { formatDate, StatusBadge } from "@/components/admin/StatusBadge";

type Props = {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
};

const TAB_STYLE: Record<OrderStatus | "all", { Icon: LucideIcon; tone: string; ring: string }> = {
  all: { Icon: Inbox, tone: "bg-ink/10 text-ink", ring: "ring-ink border-ink/40" },
  pending: { Icon: Clock, tone: "bg-amber-100 text-amber-700", ring: "ring-amber-400 border-amber-400" },
  verified: { Icon: BadgeCheck, tone: "bg-sky-100 text-sky-700", ring: "ring-sky-400 border-sky-400" },
  rejected: { Icon: XCircle, tone: "bg-red-100 text-red-700", ring: "ring-red-400 border-red-400" },
  delivered: { Icon: PackageCheck, tone: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-400 border-emerald-400" },
};

const PAYMENT_CHIP: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  REFUNDED: "bg-slate-100 text-slate-600 border-slate-200",
};

const FULFILLMENT_CHIP: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PROCESSING: "bg-sky-50 text-sky-700 border-sky-200",
  NOT_STARTED: "bg-slate-100 text-slate-600 border-slate-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
};

const chip =
  "inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide whitespace-nowrap uppercase border";

export default async function AdminOrdersPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const status = isOrderStatus(sp.status) ? sp.status : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const pageSize = 15;

  let orders: Order[] = [];
  let items = new Map<number, OrderItem[]>();
  let counts = { all: 0, pending: 0, verified: 0, rejected: 0, delivered: 0 };
  let totalFiltered = 0;
  let fetchError = "";

  try {
    counts = countOrdersByStatus();
    if (!q) {
      totalFiltered = status ? (counts[status] ?? 0) : counts.all;
    } else {
      totalFiltered = countFilteredOrders({ status, q });
    }
    orders = listOrders({
      status,
      q: q || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    items = itemsForOrders(orders.map((o) => o.id));
  } catch (err: unknown) {
    console.error("AdminOrdersPage query error:", err);
    fetchError = err instanceof Error ? err.message : String(err);
  }

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const languages = (id: number) =>
    [...new Set((items.get(id) ?? []).map((i) => i.target_language))].join(", ");

  const tabs = [
    { key: undefined, style: TAB_STYLE.all, label: "All Orders", n: counts.all },
    ...ORDER_STATUSES.map((s) => ({
      key: s,
      style: TAB_STYLE[s],
      label: STATUS_LABELS[s],
      n: counts[s],
    })),
  ];

  // Helper for pagination query string
  const buildPageUrl = (targetPage: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/admin?${qs}` : "/admin";
  };

  return (
    <div className="space-y-4">
      {fetchError && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger shadow-xs">
          <strong>Database query notice:</strong> {fetchError}
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-3.5">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-gold-dark uppercase">
            Order Management
          </p>
          <h1 className="mt-1 font-serif text-3xl font-medium text-ink">Paid Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            Verify bank deposits and screenshot UTRs before marking orders verified or delivered.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/admin/export"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-600 hover:text-white hover:border-emerald-600 shadow-xs"
          >
            <Download size={14} />
            Export CSV
          </a>
        </div>
      </div>

      {/* Stat cards / Status filters */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tabs.map(({ key, style: { Icon, tone, ring }, label, n }) => {
          const active = key === status;
          const href = key ? `/admin?status=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}` : `/admin${q ? `?q=${encodeURIComponent(q)}` : ""}`;
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition-all hover:shadow-md ${
                active
                  ? `border-transparent ring-2 ${ring} bg-white shadow-xs`
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon size={20} />
              </span>
              <div className="min-w-0">
                <span className="block text-xl font-bold leading-none text-ink">{n}</span>
                <span className="mt-1.5 block truncate text-[0.7rem] font-semibold tracking-wider text-slate-500 uppercase">
                  {label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form className="flex flex-1 max-w-lg gap-2" action="/admin">
          {status && <input type="hidden" name="status" value={status} />}
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search buyer name, email, phone, UTR or reference..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm text-ink placeholder:text-slate-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 shadow-xs"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-gold-dark shadow-xs"
          >
            Search
          </button>
          {q && (
            <Link
              href={status ? `/admin?status=${status}` : "/admin"}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
              title="Clear search"
            >
              <X size={14} />
            </Link>
          )}
        </form>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500">
          <span>
            Showing <strong className="text-ink">{orders.length}</strong> of{" "}
            <strong className="text-ink">{totalFiltered}</strong> {totalFiltered === 1 ? "order" : "orders"}
          </span>
        </div>
      </div>

      {/* Empty State */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <Inbox size={24} />
          </div>
          <p className="font-serif text-lg font-medium text-ink">No orders found</p>
          <p className="mt-1 text-sm text-slate-400 max-w-sm">
            {q || status
              ? "No orders matched your current filter criteria. Try clearing search or choosing another status tab."
              : "When customers submit payments, their orders will appear here automatically."}
          </p>
          {(q || status) && (
            <Link
              href="/admin"
              className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-slate-50 transition-colors shadow-xs"
            >
              Reset Filters
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-[0.7rem] font-semibold tracking-wider text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Books</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2">Delivery</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      className="align-middle transition-colors hover:bg-slate-50/60"
                    >
                      {/* Order ref + date */}
                      <td className="whitespace-nowrap px-3 py-2">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-mono text-xs font-semibold text-ink hover:text-gold-dark hover:underline"
                        >
                          {o.ref}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(o.created_at)}</p>
                      </td>

                      {/* Customer */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 font-serif text-xs font-semibold text-gold-dark uppercase">
                            {(o.buyer_name || o.email || "?").charAt(0)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-xs text-ink">{o.buyer_name}</p>
                            <p className="max-w-[180px] truncate text-[11px] text-slate-400" title={o.email}>
                              {o.email}
                            </p>
                            {o.whatsapp && (
                              <p className="text-[11px] text-slate-400">+{o.whatsapp}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Books */}
                      <td className="max-w-[220px] px-3 py-2">
                        <p
                          className="line-clamp-2 font-medium leading-snug text-xs text-ink"
                          title={o.product_title}
                        >
                          {o.product_title}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
                          {orderAuthor(o)}
                        </p>
                      </td>

                      {/* Amount */}
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <p className="font-semibold text-xs text-ink">{formatINR(o.amount)}</p>
                        {o.amount_paid != null && (
                          <p
                            className={`text-[11px] ${
                              amountMismatch(o) ? "font-semibold text-danger" : "text-emerald-700"
                            }`}
                          >
                            Paid {formatINR(o.amount_paid)}
                          </p>
                        )}
                      </td>

                      {/* Payment */}
                      <td className="px-3 py-2">
                        <p
                          className="max-w-[130px] truncate font-mono text-xs text-slate-700"
                          title={o.utr}
                        >
                          {o.utr || "—"}
                        </p>
                        <div className="mt-1">
                          {o.screenshot_file ? (
                            <a
                              href={`/api/admin/orders/${o.id}/screenshot`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 hover:bg-purple-600 hover:text-white transition-colors"
                            >
                              <ImageIcon size={11} />
                              Screenshot
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              <CreditCard size={11} />
                              Gateway
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Delivery */}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`${chip} bg-ink text-white border-ink`}>
                            {languages(o.id) || o.target_language}
                          </span>
                          <span
                            className={`${chip} ${
                              PAYMENT_CHIP[o.payment_status] ?? PAYMENT_CHIP.PENDING
                            }`}
                          >
                            {o.payment_status}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`${chip} ${
                              FULFILLMENT_CHIP[o.fulfillment_status] ?? FULFILLMENT_CHIP.NOT_STARTED
                            }`}
                          >
                            {String(o.fulfillment_status).replace("_", " ")}
                          </span>
                          <span className="whitespace-nowrap text-[11px] text-slate-400">
                            {o.download_count} ↓
                          </span>
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="px-3 py-2">
                        <StatusBadge status={o.status} />
                      </td>

                      {/* Action */}
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gold-dark shadow-xs"
                        >
                          Open
                          <ChevronRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="space-y-3 lg:hidden">
            {orders.map((o) => (
              <div
                key={o.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-mono text-sm font-bold text-ink hover:text-gold-dark hover:underline"
                    >
                      {o.ref}
                    </Link>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(o.created_at)}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                <div className="mt-3">
                  <p className="font-semibold text-sm text-ink">{o.buyer_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {o.product_title} · {orderAuthor(o)} ·{" "}
                    <span className="font-semibold text-ink uppercase">
                      {languages(o.id) || o.target_language}
                    </span>
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="font-mono text-slate-500 max-w-[50%] truncate">
                    UTR: {o.utr || "Gateway"}
                  </span>
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-semibold ${
                        amountMismatch(o) ? "text-danger" : "text-ink"
                      }`}
                    >
                      {formatINR(o.amount_paid ?? o.amount)}
                    </span>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-gold-dark"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-xs">
              <div className="text-xs text-slate-500">
                Page <strong className="text-ink">{page}</strong> of{" "}
                <strong className="text-ink">{totalPages}</strong>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={buildPageUrl(page - 1)}
                  aria-disabled={page <= 1}
                  tabIndex={page <= 1 ? -1 : undefined}
                  className={`inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium transition ${
                    page <= 1
                      ? "pointer-events-none opacity-40 bg-slate-50 text-slate-400"
                      : "bg-white text-ink hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <ChevronLeft size={14} />
                  Previous
                </Link>
                <Link
                  href={buildPageUrl(page + 1)}
                  aria-disabled={page >= totalPages}
                  tabIndex={page >= totalPages ? -1 : undefined}
                  className={`inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium transition ${
                    page >= totalPages
                      ? "pointer-events-none opacity-40 bg-slate-50 text-slate-400"
                      : "bg-white text-ink hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  Next
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
