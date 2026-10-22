"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Package, User } from "lucide-react";
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

function ProfileMenu({
  name,
  email,
  isAdmin,
  onSignOut,
}: {
  name: string;
  email?: string;
  isAdmin: boolean;
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "flex w-full items-center gap-3 px-4 py-2.5 text-sm text-ink/85 hover:bg-gold/10 hover:text-ink transition-colors";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={email}
        className="flex items-center gap-1.5 rounded-full border border-line bg-white/70 p-1 pr-2 text-ink hover:border-gold hover:bg-white transition"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 font-serif text-sm font-semibold uppercase text-gold-dark">
          {name.charAt(0)}
        </span>
        <ChevronDown size={14} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            {email && <p className="truncate text-xs text-muted">{email}</p>}
          </div>
          <Link href="/profile" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            <User size={16} className="text-gold-dark" />
            Profile
          </Link>
          <Link href="/orders" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            <Package size={16} className="text-gold-dark" />
            My Orders
          </Link>
          {isAdmin && (
            <Link href="/admin" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
              <LayoutDashboard size={16} className="text-gold-dark" />
              Admin Panel
            </Link>
          )}
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            className={`${itemClass} text-danger hover:bg-danger/10 hover:text-danger`}
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </div>
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
                <ProfileMenu
                  key={pathname}
                  name={user.fullName || user.email?.split("@")[0] || "Account"}
                  email={user.email}
                  isAdmin={role === "admin"}
                  onSignOut={signOut}
                />
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
                        href="/profile"
                        onClick={() => setOpenOn(null)}
                        className="flex items-center gap-3 border-b border-line py-4 font-serif text-2xl text-ink"
                      >
                        <User size={22} className="text-gold-dark" />
                        <span>Profile</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/orders"
                        onClick={() => setOpenOn(null)}
                        className="flex items-center gap-3 border-b border-line py-4 font-serif text-2xl text-ink"
                      >
                        <Package size={22} className="text-gold-dark" />
                        <span>My Orders</span>
                      </Link>
                    </li>
                    <li className="py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenOn(null);
                          signOut();
                        }}
                        className="flex items-center gap-2 text-left font-sans text-sm font-medium text-danger"
                      >
                        <LogOut size={16} />
                        Logout ({user.email})
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
