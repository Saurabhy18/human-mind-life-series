import Link from "next/link";
import { CONFIG } from "@/config/site.config";
import { Logo } from "@/components/layout/Header";

/**
 * Minimal layout for paid-ad landing pages: no main navigation (fewer
 * distractions), but policy and contact links stay visible as ad platforms require.
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-paper">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <Link href="/books" className="text-sm font-medium text-ink/70 hover:text-ink">
            All books
          </Link>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="border-t border-line bg-white pb-24 md:pb-0">
        <div className="container-page flex flex-col gap-3 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {CONFIG.PUBLISHER_NAME}</p>
          <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy-policy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms-and-conditions" className="hover:text-ink">Terms</Link>
            <Link href="/refund-policy" className="hover:text-ink">Refunds</Link>
            <Link href="/contact" className="hover:text-ink">Contact</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
