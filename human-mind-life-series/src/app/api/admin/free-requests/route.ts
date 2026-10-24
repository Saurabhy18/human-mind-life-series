import { NextResponse } from "next/server";
import { verifyAdminApi } from "@/lib/server/auth";
import {
  countFilteredFreeRequests,
  countFreeByStatus,
  listFreeRequests,
} from "@/lib/server/free-requests";
import { isFreeStatus, type FreeStatus } from "@/lib/free-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/free-requests
 * Returns paginated free requests for the admin dashboard.
 * Requires admin authentication and enforces 15 records per page by default.
 */
export async function GET(req: Request) {
  const authError = await verifyAdminApi();
  if (authError) return authError;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") || undefined;
  const status = isFreeStatus(statusParam) ? (statusParam as FreeStatus) : undefined;
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100);

  const rawPage = parseInt(url.searchParams.get("page") || "1", 10);
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);

  const rawPageSize = parseInt(url.searchParams.get("pageSize") || url.searchParams.get("limit") || "15", 10);
  const pageSize = Math.min(Math.max(1, isNaN(rawPageSize) ? 15 : rawPageSize), 100);

  const counts = countFreeByStatus();
  const totalFiltered = !q
    ? (status ? (counts[status] ?? 0) : counts.all)
    : countFilteredFreeRequests({ status, q });
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const offset = (page - 1) * pageSize;

  const requests = listFreeRequests({
    status,
    q: q || undefined,
    limit: pageSize,
    offset,
  });

  return NextResponse.json({
    success: true,
    requests,
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
