import { NextResponse } from "next/server";
import { verifyAdminApi } from "@/lib/server/auth";
import {
  countFilteredOrders,
  countOrdersByStatus,
  itemsForOrders,
  listOrders,
} from "@/lib/server/orders";
import { isOrderStatus, type OrderStatus } from "@/lib/order-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders
 * Returns paginated orders for the admin dashboard.
 * Requires admin authentication and enforces 15 records per page by default.
 */
export async function GET(req: Request) {
  const authError = await verifyAdminApi();
  if (authError) return authError;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") || undefined;
  const status = isOrderStatus(statusParam) ? (statusParam as OrderStatus) : undefined;
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
  
  const rawPage = parseInt(url.searchParams.get("page") || "1", 10);
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);

  const rawPageSize = parseInt(url.searchParams.get("pageSize") || url.searchParams.get("limit") || "15", 10);
  const pageSize = Math.min(Math.max(1, isNaN(rawPageSize) ? 15 : rawPageSize), 100);

  const counts = countOrdersByStatus();
  const totalFiltered = !q
    ? (status ? (counts[status] ?? 0) : counts.all)
    : countFilteredOrders({ status, q });
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const offset = (page - 1) * pageSize;

  const orders = listOrders({
    status,
    q: q || undefined,
    limit: pageSize,
    offset,
  });

  const items = itemsForOrders(orders.map((o) => o.id));
  const ordersWithItems = orders.map((o) => ({
    ...o,
    items: items.get(o.id) ?? [],
  }));

  return NextResponse.json({
    success: true,
    orders: ordersWithItems,
    pagination: {
      page,
      pageSize,
      total: totalFiltered,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    counts,
  });
}
