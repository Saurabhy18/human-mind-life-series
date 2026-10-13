import "server-only";
import crypto from "node:crypto";
import { ENV } from "@/config/env.server";
import { getDb } from "./db";
import { logger, errorMessage } from "./logger";
import { getOrder, type Order } from "./orders";
import { markOrderPaid, markOrderPaymentFailed } from "./fulfillment";

/**
 * Payment providers.
 *  - manual_upi (default): customer pays your UPI QR; YOU verify in the admin panel (server-side) → fulfillment.
 *  - cashfree: Cashfree hosted checkout; a SIGNED WEBHOOK (plus an API re-check) is the only thing that marks
 *    an order paid. The browser can never mark an order paid.
 */

/** Cashfree requires a customer phone. The gateway checkout collects only name + email, so a neutral
 * placeholder is sent. (Change this flow if you start collecting the customer's real phone number.) */
const PLACEHOLDER_PHONE = "9999999999";

/** Amounts are compared in integer paise to avoid floating-point drift (Cashfree uses rupee decimals). */
const paise = (rupees: number | string) => Math.round(Number(rupees) * 100);
const sameAmount = (a: number | string, b: number | string) => paise(a) === paise(b);

function cashfreeConfigured() {
  return ENV.payment.provider === "cashfree" && !!(ENV.payment.cashfreeClientId && ENV.payment.cashfreeSecretKey);
}

export function gatewayEnabled(): boolean {
  return cashfreeConfigured();
}

export type CheckoutMode = "gateway" | "upi" | "closed";

/**
 * What customers can do at checkout:
 *  - gateway: Cashfree is fully configured (PAYMENT_PROVIDER=cashfree + client id + secret key)
 *  - upi:     the older manual UPI QR flow, only when PAYMENT_PROVIDER=manual_upi is set on purpose
 *  - closed:  anything else (the default) — no orders or payments are accepted
 */
export function checkoutMode(): CheckoutMode {
  if (gatewayEnabled()) return "gateway";
  return ENV.payment.provider === "manual_upi" ? "upi" : "closed";
}

/** Thin Cashfree PG REST client. Never logs the secret; callers never receive it. */
async function cashfree<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${ENV.payment.cashfreeApiBase}${path}`, {
    method,
    headers: {
      "x-client-id": ENV.payment.cashfreeClientId,
      "x-client-secret": ENV.payment.cashfreeSecretKey,
      "x-api-version": ENV.payment.cashfreeApiVersion,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    // Cashfree returns a JSON { message, code } body on errors; keep the message, never the credentials.
    let detail = "";
    try {
      detail = ((await res.json()) as { message?: string }).message ?? "";
    } catch {}
    throw new Error(`Cashfree ${method} ${path} → HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return (await res.json()) as T;
}

type CfOrder = {
  cf_order_id?: string;
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status: string; // ACTIVE | PAID | EXPIRED | TERMINATED | ...
  payment_session_id?: string;
};
type CfPayment = {
  cf_payment_id: string | number;
  order_id?: string;
  payment_status: string; // SUCCESS | FAILED | PENDING | USER_DROPPED | ...
  payment_amount: number;
  payment_currency: string;
};

export type CheckoutData = {
  provider: "cashfree";
  /** Sandbox or production — the client SDK is initialised in this mode. */
  mode: "sandbox" | "production";
  /** Opaque, single-order session token used by the Cashfree JS SDK. Not a secret key. */
  paymentSessionId: string;
  orderRef: string;
  amount: number;
  currency: string;
};

/**
 * Creates (or reuses) the Cashfree order for one of our orders. Returns only what the checkout SDK needs.
 * `returnBaseUrl` (the customer's current origin) is where Cashfree sends the browser back after the hosted
 * checkout; it defaults to the configured site URL. The webhook `notify_url` always stays the public site URL.
 */
export async function createGatewayPayment(order: Order, returnBaseUrl?: string): Promise<CheckoutData> {
  if (!cashfreeConfigured()) throw new Error("Payment gateway is not configured");
  const returnBase = (returnBaseUrl || ENV.frontendUrl).replace(/\/$/, "");

  let cf: CfOrder;
  if (order.provider_order_id) {
    // Already created: fetch the live order to get a current payment session (and to be sure it is still payable).
    cf = await cashfree<CfOrder>("GET", `/orders/${encodeURIComponent(order.provider_order_id)}`);
  } else {
    cf = await cashfree<CfOrder>("POST", "/orders", {
      order_id: order.ref, // our own reference is the Cashfree order id (unique)
      order_amount: order.amount, // RUPEES (Cashfree uses decimals, not paise)
      order_currency: order.currency,
      customer_details: {
        customer_id: `cust_${order.customer_id ?? order.id}`,
        customer_name: order.buyer_name,
        customer_email: order.email,
        customer_phone: PLACEHOLDER_PHONE,
      },
      order_meta: {
        return_url: `${returnBase}/order/status/${order.ref}`,
        notify_url: `${ENV.frontendUrl}/api/payment/webhook`,
      },
      order_note: order.product_title.slice(0, 200),
      order_tags: { ref: order.ref, package: order.package_type },
    });
    if (cf.order_id !== order.ref || !sameAmount(cf.order_amount, order.amount) || cf.order_currency !== order.currency) {
      throw new Error("Gateway order does not match our order");
    }
    getDb()
      .prepare("UPDATE orders SET provider_order_id = ?, payment_provider = 'cashfree' WHERE id = ? AND provider_order_id IS NULL")
      .run(order.ref, order.id);
  }

  if (!cf.payment_session_id) throw new Error("Cashfree did not return a payment session");
  return {
    provider: "cashfree",
    mode: ENV.payment.cashfreeEnv,
    paymentSessionId: cf.payment_session_id,
    orderRef: order.ref,
    amount: order.amount,
    currency: order.currency,
  };
}

/**
 * Verifies a Cashfree webhook signature: Base64( HMAC-SHA256( secretKey, timestamp + rawBody ) ),
 * computed over the EXACT raw request body. `timestamp` is the x-webhook-timestamp header.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret = ENV.payment.cashfreeSecretKey,
): boolean {
  if (!signature || !timestamp || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type WebhookResult = { status: number; body: { ok: boolean; message: string } };

/**
 * POST /api/payment/webhook (Cashfree). Steps:
 *  1. verify the HMAC signature over the raw body (+ the x-webhook-timestamp header)
 *  2. find our order via the Cashfree order id (which is our order ref)
 *  3. check amount and currency
 *  4. check the payment status
 *  5. re-check with the Cashfree API (defence in depth)
 *  6. idempotent: the cf_payment_id is the idempotency key, so retries/duplicates are ignored
 *  7. mark paid → fulfillment starts (queued, not run inside this request)
 */
export async function handleCashfreeWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
  if (!cashfreeConfigured()) return { status: 404, body: { ok: false, message: "Not enabled" } };
  if (!verifyWebhookSignature(rawBody, headers.get("x-webhook-signature"), headers.get("x-webhook-timestamp"))) {
    logger.warn("Webhook rejected: invalid signature");
    return { status: 400, body: { ok: false, message: "Invalid signature" } };
  }

  let evt: { type?: string; data?: { order?: Partial<CfOrder>; payment?: Partial<CfPayment> } };
  try {
    evt = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, message: "Invalid JSON" } };
  }
  const type = evt.type ?? "";
  const providerOrderId = evt.data?.order?.order_id;
  const payment = evt.data?.payment;
  const success = type === "PAYMENT_SUCCESS_WEBHOOK";
  const failure = type === "PAYMENT_FAILED_WEBHOOK" || type === "PAYMENT_USER_DROPPED_WEBHOOK";
  if ((!success && !failure) || !providerOrderId) {
    return { status: 200, body: { ok: true, message: "Ignored event" } };
  }

  const row = getDb()
    .prepare("SELECT id FROM orders WHERE payment_provider = 'cashfree' AND provider_order_id = ?")
    .get(providerOrderId) as { id: number } | undefined;
  const order = row ? getOrder(row.id) : undefined;
  if (!order) {
    logger.warn("Webhook for unknown order", { providerOrderId });
    return { status: 200, body: { ok: true, message: "Unknown order" } };
  }

  if (failure) {
    markOrderPaymentFailed(order.id, `Gateway reported a ${type === "PAYMENT_USER_DROPPED_WEBHOOK" ? "cancelled" : "failed"} payment attempt`);
    return { status: 200, body: { ok: true, message: "Payment failure recorded" } };
  }

  if (!payment || payment.payment_status !== "SUCCESS" || !payment.cf_payment_id) {
    return { status: 200, body: { ok: true, message: "Not a completed payment" } };
  }
  if (!sameAmount(payment.payment_amount ?? 0, order.amount) || payment.payment_currency !== order.currency) {
    logger.error("Webhook amount/currency mismatch — NOT marking paid", { orderId: order.id, amount: payment.payment_amount, currency: payment.payment_currency });
    return { status: 200, body: { ok: true, message: "Amount mismatch" } };
  }

  // Defence in depth: confirm with the Cashfree API, not only the webhook body.
  try {
    const live = await cashfree<CfOrder>("GET", `/orders/${encodeURIComponent(providerOrderId)}`);
    if (live.order_status !== "PAID" || !sameAmount(live.order_amount, order.amount) || live.order_currency !== order.currency || live.order_id !== order.ref) {
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
    provider: "cashfree",
    idempotencyKey: `cashfree:payment:${payment.cf_payment_id}`,
    amount: order.amount,
    currency: order.currency,
    providerPaymentId: String(payment.cf_payment_id),
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
  if (!cashfreeConfigured() || order.payment_provider !== "cashfree" || !order.provider_order_id || order.payment_status === "PAID") return;
  const live = await cashfree<CfOrder>("GET", `/orders/${encodeURIComponent(order.provider_order_id)}`);
  if (live.order_status !== "PAID" || !sameAmount(live.order_amount, order.amount) || live.order_currency !== order.currency || live.order_id !== order.ref) return;
  const payments = await cashfree<CfPayment[]>("GET", `/orders/${encodeURIComponent(order.provider_order_id)}/payments`);
  const paid = payments.find((p) => p.payment_status === "SUCCESS" && sameAmount(p.payment_amount, order.amount) && p.payment_currency === order.currency);
  if (!paid) return;
  await markOrderPaid({
    orderId: order.id,
    provider: "cashfree",
    idempotencyKey: `cashfree:payment:${paid.cf_payment_id}`,
    amount: order.amount,
    currency: order.currency,
    providerPaymentId: String(paid.cf_payment_id),
    providerOrderId: order.provider_order_id,
  });
}
