import Link from "next/link";
import { ENV } from "@/config/env.server";
import { requireAdmin } from "@/lib/server/auth";
import { listCustomers, listJobs, recentDownloads, recentPayments, translationMatrix, translationMetrics, type TranslationCell } from "@/lib/server/adminReports";
import { getBookSource } from "@/lib/server/translation/bookSource";
import { FEATURED_LANGUAGES } from "@/config/languages";
import { PAID_BOOKS, formatINR, type Book } from "@/lib/products";
import { formatDate } from "@/components/admin/StatusBadge";
import { retryTranslationAction } from "../../actions";

const JOB_STYLE: Record<string, string> = {
  QUEUED: "bg-amber-50 text-amber-800 ring-amber-200",
  PROCESSING: "bg-sky-50 text-sky-800 ring-sky-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  FAILED: "bg-red-50 text-red-800 ring-red-200",
  NOT_STARTED: "bg-paper text-muted ring-line",
};

export default async function AdminTranslationsPage() {
  await requireAdmin();
  const jobs = listJobs();
  const { totals, byLanguage, byBook, reuse } = translationMetrics();
  const failed = jobs.filter((j) => j.status === "FAILED");
  const payments = recentPayments(20);
  const downloads = recentDownloads(20);
  const customers = listCustomers(20);
  const matrix = translationMatrix((slug) => getBookSource(slug)?.version ?? null);
  const featured = new Set(FEATURED_LANGUAGES.map((l) => l.code));
  const extra = [...new Set([...matrix.values()].flatMap((m) => [...m.keys()]))].filter((c) => !featured.has(c)).sort();
  const columns = [...FEATURED_LANGUAGES, ...extra.map((code) => ({ code, name: code }))];

  return (
    <>
      <h1 className="text-3xl">Translations &amp; delivery</h1>
      <p className="mt-1 text-sm text-muted">
        Provider: <strong>{ENV.translation.provider}</strong> · Strategy: <strong>{ENV.translation.strategy}</strong> · Payments: <strong>{ENV.payment.provider}</strong> · Storage:{" "}
        <strong>{ENV.storage.driver}</strong>. Each book + language is translated once and reused for every later order.
      </p>
      {ENV.translation.provider !== "none" && !ENV.translation.salesEnabled && (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Translated editions are <strong>not offered to customers</strong> (English only). After a real translation has been produced and checked
          end to end, set <code>TRANSLATION_SALES_ENABLED=true</code> on the server and rebuild.
        </p>
      )}
      {ENV.translation.provider === "none" && (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Translation is not configured, so books are sold in English only. Set <code>GOOGLE_CLOUD_PROJECT_ID</code> and Google credentials (see README → Google Cloud setup).
        </p>
      )}

      <section className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Translations" value={totals.jobs} />
        <Stat label="Completed" value={totals.completed ?? 0} />
        <Stat label="Failed" value={totals.failed ?? 0} danger={!!totals.failed} />
        <Stat label="Characters" value={totals.chars.toLocaleString("en-IN")} />
        <Stat label="Est. API cost" value={`$${totals.cost.toFixed(2)}`} />
        <Stat label="Avg. time" value={totals.avg_ms ? `${Math.round(totals.avg_ms / 1000)} s` : "—"} />
      </section>
      <p className="mt-2 text-xs text-muted">
        {reuse.paid_translated} paid translated ebook(s) served by {totals.completed ?? 0} translation(s). Cost is an estimate from Google&apos;s list prices (${ENV.translation.pricePerMillionCharsUsd}/M chars, ${ENV.translation.pricePerPageUsd}/page) — check your Google Cloud billing for actual charges.
      </p>

      <section className="card mt-4 overflow-x-auto">
        <h2 className="p-6 pb-0 text-xl">Ebook languages</h2>
        <p className="px-6 pt-1 text-xs text-muted">
          <span className="text-emerald-700">✓</span> available (click to download) · <span className="text-amber-700">⏳</span> queued / processing ·{" "}
          <span className="text-red-700">✕</span> failed · <span>·</span> not generated yet — made automatically the first time someone buys it. Hover a code for the language name.
        </p>
        <table className="mt-2 w-full text-center text-xs">
          <thead className="border-y border-line bg-paper text-muted">
            <tr>
              <th className="sticky left-0 bg-paper px-4 py-2 text-left uppercase">Book</th>
              {columns.map((c) => (
                <th key={c.code} title={c.name} className="px-2 py-2 font-mono font-normal">{c.code}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {PAID_BOOKS.map((b) => (
              <tr key={b.slug}>
                <th scope="row" className="sticky left-0 bg-white px-4 py-2 text-left font-medium whitespace-nowrap">{b.volumeLabel ?? b.title}</th>
                {columns.map((c) => (
                  <td key={c.code} className="px-2 py-2">
                    <MatrixCell book={b} code={c.code} name={c.name} hasSource={!!getBookSource(b)} cell={matrix.get(b.slug)?.get(c.code)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="p-6 pt-3 text-xs text-muted">A row of “—” means the English source PDF is not on the server yet, so that book is delivered manually in English.</p>
      </section>

      {failed.length > 0 && (
        <section className="card mt-8 border-red-200 p-6">
          <h2 className="text-xl text-red-800">Failed jobs ({failed.length})</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {failed.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50/60 p-3">
                <span>
                  <strong>{j.book_slug}</strong> → {j.target_language} · {j.attempts} attempt(s) · <span className="text-red-800">{j.last_error}</span>
                </span>
                <RetryButton jobId={j.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mt-4 overflow-x-auto">
        <h2 className="p-6 pb-0 text-xl">Translation jobs</h2>
        {jobs.length === 0 ? (
          <p className="p-6 text-sm text-muted">No translations yet. A job is created the first time a paid order needs a new book + language.</p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead className="border-y border-line bg-paper text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-3 py-2 text-xs font-semibold">Book</th>
                <th className="px-3 py-2 text-xs font-semibold">Source → Target</th>
                <th className="px-3 py-2 text-xs font-semibold">Status</th>
                <th className="px-3 py-2 text-xs font-semibold">Created</th>
                <th className="px-3 py-2 text-xs font-semibold">Orders</th>
                <th className="px-3 py-2 text-xs font-semibold">Size</th>
                <th className="px-3 py-2 text-xs font-semibold">API cost</th>
                <th className="px-3 py-2 text-xs font-semibold">File</th>
                <th className="px-3 py-2 text-xs font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {jobs.map((j) => (
                <tr key={j.id} className="align-top">
                  <td className="px-3 py-1.5">
                    <p className="font-medium">{j.book_slug}</p>
                    <p className="font-mono text-[0.7rem] text-muted">{j.source_version} · {j.strategy}</p>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs">{j.source_language} → {j.target_language}</td>
                  <td className="px-3 py-1.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${JOB_STYLE[j.status] ?? JOB_STYLE.NOT_STARTED}`}>{j.status}</span>
                    {j.status === "PROCESSING" && <p className="mt-1 text-xs text-muted">{j.phase} · {j.progress}%</p>}
                    {j.last_error && j.status !== "COMPLETED" && <p className="mt-1 max-w-[220px] text-xs text-red-700">{j.last_error}</p>}
                  </td>
                  <td className="px-3 py-1.5 text-xs">{formatDate(j.created_at)}</td>
                  <td className="px-3 py-1.5">{j.orders}</td>
                  <td className="px-3 py-1.5 text-xs">{j.pages_translated ? `${j.pages_translated} pages` : `${j.chars_translated.toLocaleString("en-IN")} chars`}</td>
                  <td className="px-3 py-1.5 text-xs">${j.est_cost_usd.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-xs">
                    {j.translated_book_id ? <a className="text-gold-dark underline" href={`/api/admin/translations/${j.translated_book_id}/file`}>Download</a> : "—"}
                  </td>
                  <td className="px-3 py-1.5">{j.status === "FAILED" && <RetryButton jobId={j.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-xl">Books</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {PAID_BOOKS.map((b) => {
              const src = getBookSource(b);
              return (
                <li key={b.slug} className="flex items-center justify-between gap-3 py-2">
                  <span>{b.label} · {formatINR(b.price)}</span>
                  <span className={src ? "text-emerald-700" : "text-amber-700"}>{src ? `Source ${src.version}` : "No source PDF — English, manual delivery"}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="text-xl">By language</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {byLanguage.length === 0 && <li className="py-2 text-muted">—</li>}
            {byLanguage.map((l) => (
              <li key={l.lang} className="flex justify-between py-2"><span className="font-mono">{l.lang}</span><span>{l.n} job(s) · {l.chars.toLocaleString("en-IN")} chars · ${l.cost.toFixed(2)}</span></li>
            ))}
            {byBook.map((b) => (
              <li key={b.book} className="flex justify-between py-2 text-muted"><span>{b.book}</span><span>{b.n} job(s) · ${b.cost.toFixed(2)}</span></li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="text-xl">Recent payments</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {payments.length === 0 && <li className="py-2 text-muted">—</li>}
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                <Link href={`/admin/orders/${p.order_id}`} className="font-mono underline">{p.ref}</Link>
                <span>{p.provider} · {formatINR(p.amount)} {p.currency} · {p.status} · {formatDate(p.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="text-xl">Recent downloads</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {downloads.length === 0 && <li className="py-2 text-muted">—</li>}
            {downloads.map((d) => (
              <li key={d.id} className="flex flex-wrap justify-between gap-2 py-2">
                <Link href={`/admin/orders/${d.order_id}`} className="font-mono underline">{d.ref}</Link>
                <span className={d.event === "issued" ? "" : "text-amber-700"}>{d.event} · {d.target_language} · {formatDate(d.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-6 lg:col-span-2">
          <h2 className="text-xl">Customers</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {customers.length === 0 && <li className="py-2 text-muted">—</li>}
            {customers.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{c.name} · {c.email}</span>
                <span className="text-muted">{c.orders} order(s), {c.paid} paid · since {formatDate(c.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, danger }: { label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <div className="card p-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-serif text-2xl ${danger ? "text-red-700" : ""}`}>{value}</p>
    </div>
  );
}

function MatrixCell({ book, code, name, hasSource, cell }: { book: Book; code: string; name: string; hasSource: boolean; cell: TranslationCell | undefined }) {
  const label = `${book.title} — ${name}`;
  if (!hasSource) return <span className="text-muted" title={`${label}: no source PDF`}>—</span>;
  if (cell?.status === "COMPLETED" && cell.translatedBookId) {
    return <a href={`/api/admin/translations/${cell.translatedBookId}/file`} className="font-semibold text-emerald-700" title={`${label}: available`}>✓</a>;
  }
  if (code === book.sourceLanguage) return <a href={`/api/admin/books/${book.slug}/pdf`} className="font-semibold text-emerald-700" title={`${label}: original`}>✓</a>;
  if (cell?.status === "QUEUED" || cell?.status === "PROCESSING") return <span className="text-amber-700" title={`${label}: ${cell.status.toLowerCase()} ${cell.progress}%`}>⏳</span>;
  if (cell?.status === "FAILED") return <span className="text-red-700" title={`${label}: failed — see Failed jobs`}>✕</span>;
  return <span className="text-line" title={`${label}: not generated yet`}>·</span>;
}

function RetryButton({ jobId }: { jobId: number }) {
  return (
    <form action={retryTranslationAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <button className="btn-outline px-3 py-1.5 text-xs">Retry</button>
    </form>
  );
}
