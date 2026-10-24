import type { Metadata } from "next";
import Link from "next/link";
import { requireAccount, getUserOrders } from "@/lib/server/account";
import { issueAccessToken } from "@/lib/server/fulfillment";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Orders",
  description: "Track your Human Mind & Life Series orders and access your ebooks.",
};

export default async function OrdersPage() {
  const { supabase, user } = await requireAccount("/orders");
  const userOrders = await getUserOrders(supabase, user.email);

  return (
    <div className="py-12 sm:py-20">
      <div className="container-page max-w-4xl">
        <div className="card p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6 border-b border-line pb-4">
            <div>
              <span className="eyebrow">My Account</span>
              <h1 className="font-serif text-3xl font-medium text-ink">My Orders &amp; Ebooks</h1>
              <p className="text-sm text-muted mt-1">Track the status of your orders and access your ebook deliverables.</p>
            </div>
            <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-muted border border-line shrink-0">
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
