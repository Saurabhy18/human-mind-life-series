import { requireAdmin } from "@/lib/server/auth";
import { listMessages } from "@/lib/server/orders";
import { formatDate } from "@/components/admin/StatusBadge";
import { toggleMessageAction } from "../../actions";

export default async function AdminMessagesPage() {
  await requireAdmin();
  const messages = listMessages();

  return (
    <>
      <h1 className="text-3xl">Messages</h1>
      <p className="mt-1 text-sm text-muted">Enquiries sent through the contact form.</p>

      {messages.length === 0 ? (
        <div className="card mt-8 p-10 text-center text-muted">No messages yet.</div>
      ) : (
        <ul className="mt-6 space-y-4">
          {messages.map((m) => (
            <li key={m.id} className={`card p-5 ${m.handled ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {m.name} <span className="ml-2 rounded-full bg-cream px-2 py-0.5 text-xs text-ink/70">{m.topic}</span>
                  </p>
                  <p className="text-sm text-muted">
                    <a href={`mailto:${m.email}`} className="underline">{m.email}</a>
                    {m.phone && <> · +{m.phone}</>} · {formatDate(m.created_at)}
                  </p>
                </div>
                <form action={toggleMessageAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="handled" value={m.handled ? "0" : "1"} />
                  <button className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:border-ink/40">
                    {m.handled ? "Mark as open" : "Mark as handled"}
                  </button>
                </form>
              </div>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-ink/85">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
