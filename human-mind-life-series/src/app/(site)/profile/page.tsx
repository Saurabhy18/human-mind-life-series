import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/auth/actions";
import { requireAccount } from "@/lib/server/account";

export const metadata: Metadata = {
  title: "My Profile",
  description: "Your Human Mind & Life Series account details.",
};

export default async function ProfilePage() {
  const { user, role, fullName, createdAt } = await requireAccount("/profile");

  const memberSince = new Date(createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="py-12 sm:py-20">
      <div className="container-page max-w-3xl">
        {/* Header banner */}
        <div className="card p-8 sm:p-10 bg-gradient-to-br from-paper via-white to-cream/40 border-line mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-5">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gold/15 font-serif text-2xl font-semibold uppercase text-gold-dark">
                {fullName.charAt(0)}
              </span>
              <div>
                <span className="eyebrow">My Profile</span>
                <h1 className="font-serif text-3xl sm:text-4xl font-medium text-ink">{fullName}</h1>
                <p className="mt-1 text-sm text-muted">{user.email}</p>
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="btn-outline px-5 py-2.5 text-sm font-medium hover:border-danger hover:text-danger"
              >
                Logout
              </button>
            </form>
          </div>
        </div>

        {/* Account details */}
        <div className="card p-6 sm:p-8">
          <h2 className="font-serif text-xl font-medium text-ink mb-4 border-b border-line pb-3">
            Account Details
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
            <div>
              <dt className="text-muted text-xs uppercase tracking-wider font-semibold">Full Name</dt>
              <dd className="font-medium text-ink mt-1">{fullName}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs uppercase tracking-wider font-semibold">Email Address</dt>
              <dd className="font-medium text-ink mt-1 break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs uppercase tracking-wider font-semibold">Account Type</dt>
              <dd className="font-medium text-ink mt-1 capitalize">{role}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs uppercase tracking-wider font-semibold">Member Since</dt>
              <dd className="font-medium text-ink mt-1">{memberSince}</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-6">
            <Link href="/orders" className="btn-primary px-5 py-2.5 text-sm">
              View My Orders
            </Link>
            {role === "admin" && (
              <Link href="/admin" className="btn-outline px-5 py-2.5 text-sm">
                Admin Panel
              </Link>
            )}
            <Link href="/contact" className="btn-outline px-5 py-2.5 text-sm">
              Support / Help
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
