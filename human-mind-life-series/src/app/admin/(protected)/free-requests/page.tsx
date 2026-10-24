import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  Search,
  X,
} from "lucide-react";
import { requireAdmin } from "@/lib/server/auth";
import {
  countFilteredFreeRequests,
  countFreeByStatus,
  listFreeRequests,
  type FreeRequest,
} from "@/lib/server/free-requests";
import { FREE_STATUSES, FREE_STATUS_LABELS, isFreeStatus, type FreeStatus } from "@/lib/free-status";
import { formatDate } from "@/components/admin/StatusBadge";
import { FreeStatusBadge } from "@/components/admin/FreeStatusBadge";

type Props = {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
};

/** FREE BOOK REQUESTS — modern admin UI with pagination and filtering. */
export default async function AdminFreeRequestsPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const status = isFreeStatus(sp.status) ? (sp.status as FreeStatus) : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const pageSize = 15;

  let requests: FreeRequest[] = [];
  let counts = { all: 0, received: 0, sent: 0, completed: 0 };
  let totalFiltered = 0;

  try {
    counts = countFreeByStatus();
    if (!q) {
      totalFiltered = status ? (counts[status] ?? 0) : counts.all;
    } else {
      totalFiltered = countFilteredFreeRequests({ status, q });
    }
    requests = listFreeRequests({
      status,
      q: q || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  } catch (err: unknown) {
    console.error("AdminFreeRequestsPage query error:", err);
  }

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  const tabs = [
    { key: undefined, label: "All Requests", n: counts.all },
    ...FREE_STATUSES.map((s) => ({
      key: s,
      label: FREE_STATUS_LABELS[s],
      n: counts[s],
    })),
  ];

  const buildPageUrl = (targetPage: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/free-requests?${qs}` : "/admin/free-requests";
  };

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-3.5">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-success uppercase">
            Reader Community
          </p>
          <h1 className="mt-1 font-serif text-3xl font-medium text-ink">Free Requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Complimentary book requests received from visitors and readers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/admin/free-requests/export"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:bg-slate-50 hover:border-slate-300 shadow-xs"
          >
            <Download size={14} />
            Export CSV
          </a>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = t.key === status;
          const href = t.key
            ? `/admin/free-requests?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`
            : `/admin/free-requests${q ? `?q=${encodeURIComponent(q)}` : ""}`;
          return (
            <Link
              key={t.label}
              href={href}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                active
                  ? "bg-slate-900 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-ink"
              }`}
            >
              {t.label}{" "}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {t.n}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form className="flex flex-1 max-w-md gap-2" action="/admin/free-requests">
          {status && <input type="hidden" name="status" value={status} />}
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name, email, phone or reference..."
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
              href={status ? `/admin/free-requests?status=${status}` : "/admin/free-requests"}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
              title="Clear search"
            >
              <X size={14} />
            </Link>
          )}
        </form>

        <span className="text-xs text-slate-500">
          Showing <strong className="text-ink">{requests.length}</strong> of{" "}
          <strong className="text-ink">{totalFiltered}</strong> requests
        </span>
      </div>

      {/* Requests Table / Cards */}
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <Inbox size={24} />
          </div>
          <p className="font-serif text-lg font-medium text-ink">No free requests found</p>
          <p className="mt-1 text-sm text-slate-400 max-w-sm">
            {q || status
              ? "No free-book requests matched your search. Try adjusting or clearing your filters."
              : "When readers submit requests for free volumes, they will be listed here."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[0.7rem] font-semibold tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2">Ref / Date</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Book Requested</th>
                  <th className="px-3 py-2">Access</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <tr key={r.id} className="align-middle hover:bg-slate-50/60 transition-colors">
                    <td className="whitespace-nowrap px-3 py-2">
                      <p className="font-mono text-xs font-semibold text-ink">{r.ref}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(r.created_at)}</p>
                    </td>
                    <td className="px-3 py-2 font-medium text-xs text-ink">{r.name}</td>
                    <td className="px-3 py-2">
                      <p className="text-xs text-ink max-w-[170px] truncate" title={r.email}>
                        {r.email}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {r.whatsapp ? `+${r.whatsapp}` : "—"}
                      </p>
                    </td>
                    <td className="max-w-[220px] px-3 py-2">
                      <p className="font-medium text-xs text-ink line-clamp-1">{r.book_title}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{r.author || "—"}</p>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.download_token_hash ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          {r.download_count} downloaded
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Manual delivery</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <FreeStatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/free-requests/${r.id}`}
                        className="inline-flex items-center rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gold-dark transition shadow-xs"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 lg:hidden">
            {requests.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-bold text-ink">{r.ref}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(r.created_at)}</p>
                  </div>
                  <FreeStatusBadge status={r.status} />
                </div>
                <div className="mt-2.5">
                  <p className="font-semibold text-sm text-ink">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.email}</p>
                  <p className="text-xs font-medium text-gold-dark mt-1">{r.book_title}</p>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[11px] text-slate-400">
                    {r.download_token_hash ? `${r.download_count} downloads` : "Manual"}
                  </span>
                  <Link
                    href={`/admin/free-requests/${r.id}`}
                    className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-gold-dark"
                  >
                    View →
                  </Link>
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
