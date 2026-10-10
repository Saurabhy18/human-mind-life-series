import "server-only";
import crypto from "node:crypto";
import { ENV } from "@/config/env.server";
import { CONFIG } from "@/config/site.config";
import { getDb } from "./db";
import { logger, errorMessage } from "./logger";
import { getOrder, type Order } from "./orders";
import { markOrderPaid, markOrderPaymentFailed } from "./fulfillment";

/**
 * Payment providers.
 *  - manual_upi (default): customer pays your UPI QR; YOU verify in the admin panel (server-side) → fulfillment.
 *  - razorpay: hosted checkout; the SIGNED WEBHOOK (plus an API re-check) is the only thing that marks an order paid.
 * The browser can never mark an order paid.
 */

const toPaise = (rupees: number) => Math.round(rupees * 100);

/**
 * Outside production only Razorpay TEST-mode keys (rzp_test_…) are accepted, so local development
 * and testing can never move real money. Live keys (rzp_live_…) work only when NODE_ENV=production.
 */
export function razorpayKeyAllowed(keyId: string, isProd = ENV.isProd): boolean {
  return isProd || keyId.startsWith("rzp_test_");
}

function razorpayConfigured() {
  return (
    ENV.payment.provider === "razorpay" &&
    !!(ENV.payment.razorpayKeyId && ENV.payment.razorpayKeySecret && ENV.payment.razorpayWebhookSecret) &&
    razorpayKeyAllowed(ENV.payment.razorpayKeyId)
  );
}

export function gatewayEnabled(): boolean {
  return razorpayConfigured();
}

async function razorpay<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${ENV.payment.razorpayKeyId}:${ENV.payment.razorpayKeySecret}`).toString("base64");
  const res = await fetch(`${ENV.payment.razorpayApiBase}${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Razorpay ${method} ${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

type RzpOrder = { id: string; amount: number; amount_paid: number; currency: string; receipt: string; status: string };
type RzpPayment = { id: string; order_id: string; amount: number; currency: string; status: string };

export type CheckoutData = {
  provider: "razorpay";
  keyId: string;
  providerOrderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string };
};

/** Creates (or reuses) the gateway order for one of our orders. Returns only what the checkout widget needs. */
export async function createGatewayPayment(order: Order): Promise<CheckoutData> {
  if (!razorpayConfigured()) throw new Error("Payment gateway is not configured");
  let providerOrderId = order.provider_order_id;
  if (!providerOrderId) {
    const created = await razorpay<RzpOrder>("POST", "/v1/orders", {
      amount: toPaise(order.amount),
      currency: order.currency,
      receipt: order.ref,
      notes: { ref: order.ref, book: order.product_slug, language: order.target_language },
    });
    if (created.amount !== toPaise(order.amount) || created.currency !== order.currency || created.receipt !== order.ref) {
      throw new Error("Gateway order does not match our order");
    }
    providerOrderId = created.id;
    getDb().prepare("UPDATE orders SET provider_order_id = ?, payment_provider = 'razorpay' WHERE id = ? AND provider_order_id IS NULL").run(providerOrderId, order.id);
  }
  return {
    provider: "razorpay",
    keyId: ENV.payment.razorpayKeyId, // the PUBLIC key id — never the secret
    providerOrderId,
    amount: toPaise(order.amount),
    currency: order.currency,
    name: CONFIG.SITE_NAME,
    description: order.product_title.slice(0, 250),
    prefill: { name: order.buyer_name, email: order.email },
  };
}

export function verifyWebhookSignature(rawBody: string, signature: string | null, secret = ENV.payment.razorpayWebhookSecret): boolean {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type WebhookResult = { status: number; body: { ok: boolean; message: string } };

/**
 * POST /api/payment/webhook (Razorpay). Steps:
 *  1. verify the HMAC signature over the raw body
 *  2. find our order via the gateway order id, and check the receipt (our order ref)
 *  3. check amount and currency
 *  4. check the payment status
 *  5. re-check with the Razorpay API (defence in depth)
 *  6. idempotent: the payment id is the idempotency key, so retries/duplicates are ignored
 *  7. mark paid → fulfillment starts (queued, not run inside this request)
 */
export async function handleRazorpayWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
  if (!razorpayConfigured()) return { status: 404, body: { ok: false, message: "Not enabled" } };
  if (!verifyWebhookSignature(rawBody, headers.get("x-razorpay-signature"))) {
    logger.warn("Webhook rejected: invalid signature");
    return { status: 400, body: { ok: false, message: "Invalid signature" } };
  }

  let evt: { event?: string; payload?: { payment?: { entity?: RzpPayment }; order?: { entity?: RzpOrder } } };
  try {
    evt = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, message: "Invalid JSON" } };
  }
  const type = evt.event ?? "";
  const payment = evt.payload?.payment?.entity;
  const rzpOrder = evt.payload?.order?.entity;
  const providerOrderId = payment?.order_id ?? rzpOrder?.id;
  if (!["order.paid", "payment.captured", "payment.failed"].includes(type) || !providerOrderId) {
    return { status: 200, body: { ok: true, message: "Ignored event" } };
  }

  const row = getDb().prepare("SELECT id FROM orders WHERE payment_provider = 'razorpay' AND provider_order_id = ?").get(providerOrderId) as { id: number } | undefined;
  const order = row ? getOrder(row.id) : undefined;
  if (!order) {
    logger.warn("Webhook for unknown order", { providerOrderId });
    return { status: 200, body: { ok: true, message: "Unknown order" } };
  }
  if (rzpOrder && rzpOrder.receipt !== order.ref) {
    logger.warn("Webhook receipt mismatch", { orderId: order.id });
    return { status: 200, body: { ok: true, message: "Receipt mismatch" } };
  }

  if (type === "payment.failed") {
    markOrderPaymentFailed(order.id, "Gateway reported a failed payment attempt");
    return { status: 200, body: { ok: true, message: "Payment failure recorded" } };
  }

  const amount = payment?.amount ?? rzpOrder?.amount_paid;
  const currency = payment?.currency ?? rzpOrder?.currency;
  if (amount !== toPaise(order.amount) || currency !== order.currency) {
    logger.error("Webhook amount/currency mismatch — NOT marking paid", { orderId: order.id, amount, currency });
    return { status: 200, body: { ok: true, message: "Amount mismatch" } };
  }
  const paidOk = type === "payment.captured" ? payment?.status === "captured" : rzpOrder?.status === "paid" && (payment ? payment.status === "captured" : true);
  if (!paidOk || !payment?.id) {
    return { status: 200, body: { ok: true, message: "Not a completed payment" } };
  }

  // Defence in depth: confirm with the gateway's API, not only the webhook body.
  try {
    const live = await razorpay<RzpOrder>("GET", `/v1/orders/${encodeURIComponent(providerOrderId)}`);
    if (live.status !== "paid" || live.amount_paid < toPaise(order.amount) || live.currency !== order.currency || live.receipt !== order.ref) {
      logger.error("Gateway API does not confirm payment — NOT marking paid", { orderId: order.id });
      return { status: 200, body: { ok: true, message: "Not confirmed by gateway" } };
    }
  } catch (err) {
    // Let the gateway retry the webhook later.
    logger.error("Could not reach gateway to confirm payment", { orderId: order.id, error: errorMessage(err) });
    return { status: 503, body: { ok: false, message: "Temporary error" } };
  }

  const { duplicate } = await markOrderPaid({
    orderId: order.id,
    provider: "razorpay",
    idempotencyKey: `razorpay:payment:${payment.id}`,
    amount: order.amount,
    currency: order.currency,
    providerPaymentId: payment.id,
    providerOrderId,
    rawEvent: rawBody.slice(0, 4000),
  });
  return { status: 200, body: { ok: true, message: duplicate ? "Duplicate ignored" : "Payment recorded" } };
}

/**
 * Called when the customer returns from checkout: asks the GATEWAY (server to
 * server) whether the order is paid. Never trusts what the browser says.
 */
export async function syncGatewayPayment(order: Order): Promise<void> {
  if (!razorpayConfigured() || order.payment_provider !== "razorpay" || !order.provider_order_id || order.payment_status === "PAID") return;
  const live = await razorpay<RzpOrder>("GET", `/v1/orders/${encodeURIComponent(order.provider_order_id)}`);
  if (live.status !== "paid" || live.amount_paid < toPaise(order.amount) || live.currency !== order.currency || live.receipt !== order.ref) return;
  const payments = await razorpay<{ items: RzpPayment[] }>("GET", `/v1/orders/${encodeURIComponent(order.provider_order_id)}/payments`);
  const captured = payments.items.find((p) => p.status === "captured" && p.amount === toPaise(order.amount) && p.currency === order.currency);
  if (!captured) return;
  await markOrderPaid({
    orderId: order.id,
    provider: "razorpay",
    idempotencyKey: `razorpay:payment:${captured.id}`,
    amount: order.amount,
    currency: order.currency,
    providerPaymentId: captured.id,
    providerOrderId: order.provider_order_id,
  });
}
