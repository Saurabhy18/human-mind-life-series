import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/app/auth/actions";
import { getOrdersByEmail, type Order } from "@/lib/server/orders";
import { issueAccessToken } from "@/lib/server/fulfillment";

export const metadata: Metadata = {
  title: "My Dashboard",
  description: "View your Human Mind & Life Series account and access your library.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role || "user";
  const fullName = profile?.full_name || user.user_metadata?.full_name || "Book Reader";
  const memberSince = new Date(profile?.created_at || user.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  let userOrders: Order[] = [];
  try {
    userOrders = user.email ? getOrdersByEmail(user.email) : [];
  } catch (e) {
    console.error("Failed to load user orders:", e);
  }

  return (
    <div className="py-12 sm:py-20">
      <div className="container-page max-w-4xl">
        {/* Header banner */}
        <div className="card p-8 sm:p-10 bg-gradient-to-br from-paper via-white to-cream/40 border-line mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="eyebrow">Account Dashboard</span>
                <span className="inline-flex items-center rounded-full bg-gold/15 px-3 py-0.5 text-xs font-semibold text-gold-dark uppercase tracking-wider">
                  Role: {role}
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl font-medium text-ink">
                Welcome, {fullName}
              </h1>
              <p className="mt-1 text-sm text-muted">{user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="btn-outline px-5 py-2.5 text-sm font-medium hover:border-danger hover:text-danger"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Admin Portal Banner */}
        {role === "admin" && (
          <div className="card p-6 bg-ink text-white mb-8 border-gold/40 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-gold">Store Admin Detected</span>
                </div>
                <h2 className="font-serif text-2xl font-medium text-white">Administration Management Portal</h2>
                <p className="text-white/80 text-sm mt-1 max-w-xl">
                  Manage orders, verify manual UPI/bank payment screenshots, process free downloads, review translation feedback, and check contact inquiries.
                </p>
              </div>
              <Link
                href="/admin"
                className="btn-primary whitespace-nowrap bg-gold text-ink hover:bg-gold-light font-semibold px-6 py-3 self-start sm:self-auto text-sm shrink-0"
              >
                Open Admin Dashboard →
              </Link>
            </div>
          </div>
        )}

        {/* Account Details & Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Information */}
          <div className="card p-6 md:col-span-2">
            <h2 className="font-serif text-xl font-medium text-ink mb-4 border-b border-line pb-3">
              Account Details
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted text-xs uppercase tracking-wider font-semibold">
                  Full Name
                </dt>
                <dd className="font-medium text-ink mt-1">{fullName}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs uppercase tracking-wider font-semibold">
                  Email Address
                </dt>
                <dd className="font-medium text-ink mt-1">{user.email}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs uppercase tracking-wider font-semibold">
                  Assigned Role
                </dt>
                <dd className="font-medium text-ink mt-1 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-success"></span>
                  <span className="capitalize font-semibold">{role}</span>
                  <span className="text-xs text-muted font-normal">
                    {role === "admin" ? "(Full Administrator Access)" : "(Standard Access)"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-muted text-xs uppercase tracking-wider font-semibold">
                  Member Since
                </dt>
                <dd className="font-medium text-ink mt-1">{memberSince}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted text-xs uppercase tracking-wider font-semibold">
                  User ID
                </dt>
                <dd className="font-mono text-xs text-muted mt-1 break-all bg-paper p-2 rounded-lg border border-line">
                  {user.id}
                </dd>
              </div>
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="card p-6 flex flex-col justify-between">
            <div>
              <h2 className="font-serif text-xl font-medium text-ink mb-4 border-b border-line pb-3">
                Quick Actions
              </h2>
              <div className="space-y-3">
                {role === "admin" && (
                  <Link
                    href="/admin"
                    className="btn-primary w-full py-2.5 text-sm flex items-center justify-center text-center bg-gold-dark hover:bg-gold text-white font-semibold"
                  >
                    Admin Dashboard
                  </Link>
                )}
                <Link
                  href="/books"
                  className="btn-primary w-full py-2.5 text-sm flex items-center justify-center text-center"
                >
                  Browse Books
                </Link>
                <Link
                  href="/order/status"
                  className="btn-outline w-full py-2.5 text-sm flex items-center justify-center text-center"
                >
                  Look Up Order Status
                </Link>
                <Link
                  href="/contact"
                  className="btn-outline w-full py-2.5 text-sm flex items-center justify-center text-center"
                >
                  Support / Help
                </Link>
              </div>
            </div>
            <p className="text-xs text-muted mt-6 text-center">
              The Human Mind &amp; Life Series
            </p>
          </div>
        </div>

        {/* Placed Orders Section */}
        <div className="card p-6 sm:p-8 mt-8">
          <div className="flex items-center justify-between mb-6 border-b border-line pb-4">
            <div>
              <h2 className="font-serif text-2xl font-medium text-ink">My Orders &amp; Ebooks</h2>
              <p className="text-sm text-muted mt-1">Track the status of your orders and access your ebook deliverables.</p>
            </div>
            <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-muted border border-line">
              {userOrders.length} {userOrders.length === 1 ? "Order" : "Orders"}
            </span>
          </div>

          {userOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-paper/50 p-8 text-center">
              <p className="text-ink font-medium">No orders placed yet</p>
              <p className="text-sm text-muted mt-1">When you place an order, it will automatically appear here under your account.</p>
              <Link href="/books" className="btn-primary inline-block mt-4 text-xs py-2 px-5">
                Browse Books &amp; Packages
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {userOrders.map((ord) => {
                const isPaid = ord.status === "verified" || ord.status === "delivered" || ord.payment_status === "PAID";
                const isPending = ord.status === "pending";
                return (
                  <div key={ord.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-ink bg-paper px-2 py-0.5 rounded border border-line">
                          {ord.ref}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          isPaid ? "bg-success/15 text-success" : isPending ? "bg-gold/15 text-gold-dark" : "bg-danger/15 text-danger"
                        }`}>
                          {ord.status}
                        </span>
                      </div>
                      <h3 className="font-serif text-lg font-medium text-ink mt-2">{ord.product_title}</h3>
                      <p className="text-xs text-muted mt-0.5">
                        Amount: ₹{ord.amount} · Placed on {new Date(ord.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Link
                        href={`/order/status/${ord.ref}#t=${issueAccessToken(ord.id, "checkout")}`}
                        className="btn-outline px-4 py-2 text-xs font-medium"
                      >
                        View Order Status
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

