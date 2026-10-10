import { NextResponse } from "next/server";
import { authorizeOrder, customerStatus } from "@/lib/server/fulfillment";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/orders/:orderId/status + X-Order-Token — the customer's own order only, with each ebook's language and status. */
export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!rateLimit(`status:${clientIp(req.headers)}`, 120, 60_000).ok) return NextResponse.json({ success: false, message: "Too many requests." }, { status: 429 });
  const order = authorizeOrder((await params).orderId, req.headers.get("x-order-token"));
  // Same response for "no such order" and "wrong token", so order references cannot be probed.
  if (!order) return NextResponse.json({ success: false, message: "Order not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ success: true, ...(await customerStatus(order)) }, { headers: { "Cache-Control": "no-store" } });
}
