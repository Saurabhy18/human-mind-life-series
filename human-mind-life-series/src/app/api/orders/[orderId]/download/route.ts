import { NextResponse } from "next/server";
import { authorizeOrder, requestDownload } from "@/lib/server/fulfillment";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, hashIp } from "@/lib/server/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orders/:orderId/download + X-Order-Token
 * Allowed only when: the order exists AND the token belongs to it AND payment = PAID AND fulfillment = COMPLETED,
 * within the access window and download limit. Returns a short-lived signed URL (never a permanent link).
 */
export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`download:${ip}`, 20, 15 * 60_000).ok) return NextResponse.json({ success: false, message: "Too many requests. Please try again later." }, { status: 429 });
  const order = authorizeOrder((await params).orderId, req.headers.get("x-order-token"));
  if (!order) return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });

  const decision = await requestDownload(order, { ipHash: hashIp(ip), userAgent: req.headers.get("user-agent") || "" });
  const headers = { "Cache-Control": "no-store" };
  if (!decision.ok) return NextResponse.json({ success: false, code: decision.code, message: decision.message }, { status: decision.status, headers });
  return NextResponse.json({ success: true, downloadUrl: decision.url, expiresInSeconds: decision.expiresInSeconds }, { headers });
}
