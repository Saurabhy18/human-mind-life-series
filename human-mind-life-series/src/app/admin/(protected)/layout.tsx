import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { countUnhandledMessages } from "@/lib/server/orders";
import { countFreeByStatus } from "@/lib/server/free-requests";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  let unread = 0;
  let newFree = 0;
  try {
    unread = countUnhandledMessages();
    newFree = countFreeByStatus().received;
  } catch (err) {
    console.error("ProtectedAdminLayout counts error:", err);
  }


  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-serif text-lg">
              Admin
            </Link>
            <nav className="flex gap-4 text-sm font-medium text-ink/70">
              <Link href="/admin" className="hover:text-ink">Paid Orders</Link>
              <Link href="/admin/books" className="hover:text-ink">Books &amp; Catalogue</Link>
              <Link href="/admin/free-requests" className="hover:text-ink">
                Free Requests{newFree > 0 && <span className="ml-1 rounded-full bg-success px-1.5 text-xs text-white">{newFree}</span>}
              </Link>
              <Link href="/admin/translations" className="hover:text-ink">Translations</Link>
              <Link href="/admin/messages" className="hover:text-ink">
                Messages{unread > 0 && <span className="ml-1 rounded-full bg-gold px-1.5 text-xs text-white">{unread}</span>}
              </Link>
              <Link href="/admin/setup" className="hover:text-ink">Setup &amp; Ads</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" target="_blank" className="text-ink/60 hover:text-ink">View site ↗</Link>
            <form action={logoutAction}>
              <button type="submit" className="rounded-full border border-line px-3 py-1.5 hover:border-ink/40">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
