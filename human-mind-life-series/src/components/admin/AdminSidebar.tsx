"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ShoppingBag,
  BookOpen,
  Gift,
  Languages,
  MessageSquare,
  ShieldCheck,
  ExternalLink,
  Menu,
  X,
  FileSpreadsheet,
  Database,
  Sparkles,
} from "lucide-react";
import { AdminLogoutButton } from "./AdminLogoutButton";

interface AdminSidebarProps {
  unreadMessages?: number;
  newFreeRequests?: number;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof ShoppingBag;
  badge?: number;
  badgeColor?: string;
  exact?: boolean;
}

export function AdminSidebar({
  unreadMessages = 0,
  newFreeRequests = 0,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer when pathname changes (render-phase state adjustment per React guidelines)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  // Lock body scroll on mobile drawer open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const navItems: NavItem[] = [
    {
      href: "/admin",
      label: "Paid Orders",
      icon: ShoppingBag,
      exact: true,
    },
    {
      href: "/admin/books",
      label: "Books & Catalogue",
      icon: BookOpen,
    },
    {
      href: "/admin/free-requests",
      label: "Free Requests",
      icon: Gift,
      badge: newFreeRequests,
      badgeColor: "bg-emerald-600 text-white",
    },
    {
      href: "/admin/translations",
      label: "Translations",
      icon: Languages,
    },
    {
      href: "/admin/messages",
      label: "Messages",
      icon: MessageSquare,
      badge: unreadMessages,
      badgeColor: "bg-amber-600 text-white",
    },
    {
      href: "/admin/setup",
      label: "Setup & Ads",
      icon: ShieldCheck,
    },
  ];

  const isItemActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between overflow-y-auto p-4 sm:p-5">
      <div className="space-y-6">
        {/* Brand header */}
        <div className="border-b border-slate-200/80 pb-4">
          <Link href="/admin" className="group flex flex-col focus:outline-none">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 text-gold-dark">
                <Sparkles size={16} />
              </span>
              <span className="text-[0.65rem] font-bold tracking-[0.25em] text-gold-dark uppercase">
                Admin Console
              </span>
            </div>
            <span className="mt-2 font-serif text-lg font-medium tracking-tight text-ink group-hover:text-gold-dark transition-colors">
              Human Mind &amp; Life
            </span>
          </Link>
        </div>

        {/* Navigation links */}
        <nav className="space-y-1.5" aria-label="Admin Navigation">
          <p className="px-3 text-[0.65rem] font-semibold tracking-wider text-slate-400 uppercase">
            Main Management
          </p>
          {navItems.map((item) => {
            const active = isItemActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-gold/15 font-semibold text-gold-dark shadow-xs border-l-4 border-gold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={18}
                    className={`transition-colors ${
                      active ? "text-gold-dark" : "text-slate-400 group-hover:text-ink"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {Boolean(item.badge && item.badge > 0) && (
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold leading-none shadow-xs ${
                      item.badgeColor || "bg-gold text-white"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Quick Tools */}
        <div className="space-y-1.5 pt-2">
          <p className="px-3 text-[0.65rem] font-semibold tracking-wider text-slate-400 uppercase">
            Quick Tools
          </p>
          <a
            href="/api/admin/export"
            download
            className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-ink transition-colors"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>Export Orders CSV</span>
          </a>
          <a
            href="/api/admin/backup"
            download
            className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-ink transition-colors"
          >
            <Database size={16} className="text-sky-600" />
            <span>Snapshot DB Backup</span>
          </a>
          <Link
            href="/"
            target="_blank"
            className="flex items-center justify-between rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-ink transition-colors"
          >
            <div className="flex items-center gap-3">
              <ExternalLink size={16} className="text-slate-400" />
              <span>View Storefront</span>
            </div>
            <span className="text-[10px] text-slate-400">↗</span>
          </Link>
        </div>
      </div>

      {/* Footer / Account section */}
      <div className="mt-6 border-t border-slate-200/80 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="truncate text-xs font-semibold text-ink">Super Administrator</p>
            <p className="truncate text-[11px] text-slate-400">Security Verified</p>
          </div>
          <AdminLogoutButton />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30 border-r border-slate-200/90 bg-white/95 backdrop-blur shadow-xs">
        {navContent}
      </aside>

      {/* Mobile Top Header with Toggle */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus:outline-none"
            aria-label={mobileOpen ? "Close menu" : "Open admin menu"}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link href="/admin" className="font-serif text-base font-medium text-ink">
            Admin Console
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {unreadMessages > 0 && (
            <Link
              href="/admin/messages"
              className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200"
            >
              <MessageSquare size={12} />
              <span>{unreadMessages}</span>
            </Link>
          )}
          {newFreeRequests > 0 && (
            <Link
              href="/admin/free-requests"
              className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200"
            >
              <Gift size={12} />
              <span>{newFreeRequests}</span>
            </Link>
          )}
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        >
          <div
            className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl transition-transform"
            onClick={(e) => e.stopPropagation()}
          >
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
