import { NextResponse } from "next/server";
import { authorizeOrder } from "@/lib/server/fulfillment";
import { createGatewayPayment, gatewayEnabled } from "@/lib/server/paymentService";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, isSameOrigin } from "@/lib/server/request";
import { logger, errorMessage } from "@/lib/server/logger";

export const runtime = "nodejs";

/** POST /api/payment/create { orderId } + X-Order-Token → data needed to open the gateway checkout (no secrets). */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  if (!gatewayEnabled()) return NextResponse.json({ success: false, message: "Online checkout is not enabled." }, { status: 404 });
  if (!rateLimit(`paycreate:${clientIp(req.headers)}`, 20, 15 * 60_000).ok) return NextResponse.json({ success: false, message: "Too many requests." }, { status: 429 });

  let body: { orderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }
  const order = authorizeOrder(body.orderId, req.headers.get("x-order-token"));
  if (!order) return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
  if (order.payment_status === "PAID") return NextResponse.json({ success: false, message: "This order is already paid." }, { status: 409 });

  try {
    const checkout = await createGatewayPayment(order);
    return NextResponse.json({ success: true, checkout });
  } catch (err) {
    logger.error("Payment create failed", { orderId: order.id, error: errorMessage(err) });
    return NextResponse.json({ success: false, message: "We could not start the payment. Please try again." }, { status: 502 });
  }
}
