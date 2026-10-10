import { NextResponse } from "next/server";
import { authorizeOrder, requestDownload } from "@/lib/server/fulfillment";
import { getOrderItem, getOrderItems } from "@/lib/server/orders";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, hashIp } from "@/lib/server/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orders/:orderId/download?item=<itemId> + X-Order-Token
 * `item` is the ebook (book + language) to download; it may be left out when the order has one ebook.
 * Allowed only when: the order exists AND the token belongs to it AND the ebook belongs to this order AND
 * payment = PAID AND that ebook is ready, within its access window and download limit.
 * Returns a short-lived signed URL (never a permanent link).
 */
export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const ip = clientIp(req.headers);
  const headers = { "Cache-Control": "no-store" };
  if (!rateLimit(`download:${ip}`, 20, 15 * 60_000).ok) return NextResponse.json({ success: false, message: "Too many requests. Please try again later." }, { status: 429, headers });
  const order = authorizeOrder((await params).orderId, req.headers.get("x-order-token"));
  if (!order) return NextResponse.json({ success: false, message: "Order not found." }, { status: 404, headers });

  const raw = new URL(req.url).searchParams.get("item");
  const items = getOrderItems(order.id);
  // Another order's item id is simply "not found" here: getOrderItem only matches items of THIS order.
  const item = raw === null ? (items.length === 1 ? items[0] : undefined) : /^\d{1,12}$/.test(raw) ? getOrderItem(order.id, Number(raw)) : undefined;
  if (!item) return NextResponse.json({ success: false, message: raw === null ? "Please choose which ebook to download." : "Ebook not found in this order." }, { status: raw === null ? 400 : 404, headers });

  const decision = await requestDownload(order, item, { ipHash: hashIp(ip), userAgent: req.headers.get("user-agent") || "" });
  if (!decision.ok) return NextResponse.json({ success: false, code: decision.code, message: decision.message }, { status: decision.status, headers });
  return NextResponse.json({ success: true, downloadUrl: decision.url, expiresInSeconds: decision.expiresInSeconds }, { headers });
}
