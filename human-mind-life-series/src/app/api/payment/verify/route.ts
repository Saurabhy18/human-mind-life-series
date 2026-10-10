import { NextResponse } from "next/server";
import { authorizeOrder, customerStatus } from "@/lib/server/fulfillment";
import { getOrder } from "@/lib/server/orders";
import { syncGatewayPayment } from "@/lib/server/paymentService";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, isSameOrigin } from "@/lib/server/request";
import { logger, errorMessage } from "@/lib/server/logger";

export const runtime = "nodejs";

/**
 * POST /api/payment/verify { orderId } + X-Order-Token — called when the customer returns from checkout.
 * It ignores anything the browser claims and asks the gateway directly (server to server).
 * The webhook remains the primary confirmation; this only makes the status page update sooner.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  if (!rateLimit(`payverify:${clientIp(req.headers)}`, 30, 15 * 60_000).ok) return NextResponse.json({ success: false, message: "Too many requests." }, { status: 429 });
  let body: { orderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }
  const order = authorizeOrder(body.orderId, req.headers.get("x-order-token"));
  if (!order) return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
  try {
    await syncGatewayPayment(order);
  } catch (err) {
    logger.warn("Gateway sync failed (webhook will still confirm)", { orderId: order.id, error: errorMessage(err) });
  }
  return NextResponse.json({ success: true, ...(await customerStatus(getOrder(order.id)!)) });
}
