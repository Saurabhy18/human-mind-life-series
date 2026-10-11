"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconClose, IconMenu } from "../icons";
import { CurrencySelect } from "../currency/CurrencySelect";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/books", label: "Books" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
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
  // The menu remembers the page it was opened on, so it closes itself after navigation.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
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
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
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
          <CurrencySelect />
          <Link href="/books" className="btn-primary px-5 py-2.5">
            Buy the Books
          </Link>
        </nav>
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
        <nav id="mobile-menu" aria-label="Mobile" className="h-[calc(100dvh-4rem)] border-t border-line bg-paper md:hidden">
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
