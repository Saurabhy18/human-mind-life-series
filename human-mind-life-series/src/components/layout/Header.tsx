"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconClose, IconMenu } from "../icons";
import { CurrencySelect } from "../currency/CurrencySelect";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/books", label: "Books" },
  { href: "/contact", label: "Contact" },
];

export function Logo() {
  return (
    <Link href="/" className="group flex flex-col leading-none" aria-label="The Human Mind & Life Series — Home">
      <span className="font-sans text-[0.6rem] font-semibold tracking-[0.28em] text-gold-dark uppercase">The</span>
      <span className="font-serif text-lg font-medium tracking-tight text-ink sm:text-xl">
        Human Mind <span className="text-gold">&amp;</span> Life Series
      </span>
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const { user, role, loading, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);
  // The menu remembers the page it was opened on, so it closes itself after navigation.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
        scrolled || open ? "border-line bg-paper/95 backdrop-blur" : "border-transparent bg-paper"
      }`}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <div className="container-page flex h-16 items-center justify-between sm:h-20">
        {/* Left side: Logo + Main Nav links */}
        <div className="flex items-center gap-8 lg:gap-10">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-6 lg:gap-8 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`text-sm font-medium transition-colors ${isActive(item.href) ? "text-gold-dark" : "text-ink/75 hover:text-ink"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side: Currency, Buy CTA, and Auth buttons at the absolute right */}
        <div className="hidden items-center gap-4 lg:gap-6 md:flex">
          <CurrencySelect />
          <Link href="/books" className="btn-primary px-5 py-2.5">
            Buy the Books
          </Link>

          {/* Auth buttons at absolute right */}
          {mounted && !loading && (
            <div className="flex items-center gap-3 pl-3 border-l border-line">
              {user ? (
                <div className="flex items-center gap-3">
                  {role === "admin" && (
                    <Link
                      href="/admin"
                      className="rounded-full bg-ink text-white px-3 py-1.5 text-xs font-semibold hover:bg-gold-dark transition shadow-sm"
                    >
                      Admin Panel
                    </Link>
                  )}
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 rounded-full border border-line bg-white/70 px-3 py-1.5 text-xs font-medium text-ink hover:border-gold hover:bg-white transition"
                    title={user.email}
                  >
                    <span className="max-w-[120px] truncate">{user.fullName || user.email?.split("@")[0]}</span>
                    <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-gold-dark">
                      {role || "user"}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="text-xs font-medium text-muted hover:text-danger transition"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    href="/login"
                    className="text-sm font-medium text-ink/75 hover:text-ink transition-colors px-1"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="btn-outline px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gold-dark border-gold/40 hover:border-gold hover:bg-gold/5 transition"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <CurrencySelect />
          <button
          type="button"
          className="-mr-2 rounded-full p-2 text-ink"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpenOn(open ? null : pathname)}
        >
            {open ? <IconClose width={24} height={24} /> : <IconMenu width={24} height={24} />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="h-[calc(100dvh-4rem)] border-t border-line bg-paper md:hidden overflow-y-auto">
          <ul className="container-page flex flex-col py-4">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpenOn(null)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`block border-b border-line py-4 font-serif text-2xl ${isActive(item.href) ? "text-gold-dark" : "text-ink"}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}

            {/* Mobile Auth Items */}
            {mounted && !loading && (
              <>
                {user ? (
                  <>
                    {role === "admin" && (
                      <li>
                        <Link
                          href="/admin"
                          onClick={() => setOpenOn(null)}
                          className="flex items-center justify-between border-b border-line py-4 font-serif text-2xl text-gold-dark font-bold"
                        >
                          <span>Admin Panel</span>
                          <span className="rounded bg-ink px-2 py-0.5 text-xs font-sans font-bold uppercase text-white">
                            Store Admin
                          </span>
                        </Link>
                      </li>
                    )}
                    <li>
                      <Link
                        href="/dashboard"
                        onClick={() => setOpenOn(null)}
                        className="flex items-center justify-between border-b border-line py-4 font-serif text-2xl text-ink"
                      >
                        <span>Dashboard</span>
                        <span className="rounded bg-gold/15 px-2 py-0.5 text-xs font-sans font-bold uppercase text-gold-dark">
                          {role || "user"}
                        </span>
                      </Link>
                    </li>
                    <li className="py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenOn(null);
                          signOut();
                        }}
                        className="text-left font-sans text-sm font-medium text-danger"
                      >
                        Sign Out ({user.email})
                      </button>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Link
                        href="/login"
                        onClick={() => setOpenOn(null)}
                        className="block border-b border-line py-4 font-serif text-2xl text-ink"
                      >
                        Sign In
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/signup"
                        onClick={() => setOpenOn(null)}
                        className="block border-b border-line py-4 font-serif text-2xl text-gold-dark"
                      >
                        Create Account
                      </Link>
                    </li>
                  </>
                )}
              </>
            )}

            <li className="pt-6">
              <Link href="/books" onClick={() => setOpenOn(null)} className="btn-primary w-full py-4 text-base">
                Buy the Books
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
