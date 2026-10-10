import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { countFreeByStatus, listFreeRequests } from "@/lib/server/free-requests";
import { FREE_STATUSES, FREE_STATUS_LABELS, isFreeStatus } from "@/lib/free-status";
import { formatDate } from "@/components/admin/StatusBadge";
import { FreeStatusBadge } from "@/components/admin/FreeStatusBadge";

type Props = { searchParams: Promise<{ status?: string; q?: string }> };

/** FREE BOOK REQUESTS — kept separate from paid orders. */
export default async function AdminFreeRequestsPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const status = isFreeStatus(sp.status) ? sp.status : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const requests = listFreeRequests({ status, q: q || undefined });
  const counts = countFreeByStatus();

  const tabs = [{ key: undefined, label: "All", n: counts.all }, ...FREE_STATUSES.map((s) => ({ key: s, label: FREE_STATUS_LABELS[s], n: counts[s] }))];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-success uppercase">Free Book Requests</p>
          <h1 className="mt-1 text-3xl">Free Requests</h1>
          <p className="mt-1 text-sm text-muted">No payment involved. These are separate from paid orders.</p>
        </div>
        <a href="/api/admin/free-requests/export" className="btn-outline px-4 py-2">Export CSV</a>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = t.key === status;
          const href = t.key ? `/admin/free-requests?status=${t.key}` : "/admin/free-requests";
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

      <form className="mt-4 flex max-w-md gap-2" action="/admin/free-requests">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Search name, email, phone or reference" className="input py-2" />
        <button className="btn-primary px-4 py-2">Search</button>
      </form>

      {requests.length === 0 ? (
        <div className="card mt-8 p-10 text-center text-muted">No free-book requests found.</div>
      ) : (
        <>
          <div className="card mt-6 hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-paper text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Ref / Request date</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email / WhatsApp</th>
                  <th className="px-4 py-3">Book</th>
                  <th className="px-4 py-3">Downloads</th>
                  <th className="px-4 py-3">Delivery status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {requests.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-paper/60">
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold">{r.ref}</p>
                      <p className="text-xs text-muted">{formatDate(r.created_at)}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs">{r.email}</p>
                      <p className="text-xs text-muted">{r.whatsapp ? `+${r.whatsapp}` : "—"}</p>
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      {r.book_title}
                      <p className="text-xs text-muted">{r.author}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">{r.download_token_hash ? `${r.download_count} via link` : "Manual"}</td>
                    <td className="px-4 py-3"><FreeStatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/free-requests/${r.id}`} className="btn-outline px-3 py-1.5 text-xs">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-6 space-y-3 lg:hidden">
            {requests.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/free-requests/${r.id}`} className="card block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold">{r.ref}</p>
                      <p className="text-xs text-muted">{formatDate(r.created_at)}</p>
                    </div>
                    <FreeStatusBadge status={r.status} />
                  </div>
                  <p className="mt-3 font-medium">{r.name}</p>
                  <p className="text-sm text-muted">{r.email}</p>
                  <p className="text-sm text-muted">{r.book_title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
