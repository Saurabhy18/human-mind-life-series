import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getReq, jsonReq, mockCashfree, ORIGIN, signWebhook, webhookBody, WEBHOOK_TS, writeSourceBook } from "./support/helpers";

let cf: ReturnType<typeof mockCashfree>;

async function newPaidFlowOrder(lang = "fr") {
  const { POST } = await import("@/app/api/orders/route");
  const res = await POST(jsonReq("/api/orders", { bookId: "volume-4", targetLanguage: lang, customerName: "Asha Rao", customerEmail: `asha+${Math.random()}@example.com`, consent: true }));
  const order = await res.json();
  const create = await import("@/app/api/payment/create/route");
  const pay = await create.POST(jsonReq("/api/payment/create", { orderId: order.orderId }, { "x-order-token": order.accessToken }));
  const payBody = await pay.json();
  return { ref: order.orderId as string, token: order.accessToken as string, checkout: payBody.checkout, status: pay.status };
}

async function sendWebhook(body: string, signature = signWebhook(body), timestamp = WEBHOOK_TS) {
  const { POST } = await import("@/app/api/payment/webhook/route");
  const res = await POST(
    new Request(`${ORIGIN}/api/payment/webhook`, {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-webhook-signature": signature, "x-webhook-timestamp": timestamp },
    }),
  );
  return { status: res.status, body: await res.json() };
}

/** A Cashfree PAYMENT_SUCCESS_WEBHOOK body for an order ref + its simulated payment. */
function successBody(ref: string, payment = cf.pay(ref)) {
  return webhookBody("PAYMENT_SUCCESS_WEBHOOK", payment, cf.orders.get(ref)!);
}

async function order(ref: string) {
  const { getOrderByRef } = await import("@/lib/server/orders");
  return getOrderByRef(ref)!;
}

async function itemKey(orderId: number) {
  const { getOrderItems } = await import("@/lib/server/orders");
  return getOrderItems(orderId)[0].cache_key;
}

async function count(sql: string, ...args: unknown[]) {
  const { getDb } = await import("@/lib/server/db");
  return (getDb().prepare(sql).get(...args) as { n: number }).n;
}

beforeAll(async () => {
  await writeSourceBook("volume-4");
  cf = mockCashfree();
});
afterAll(() => cf.restore());
beforeEach(() => cf.setDown(false));

describe("POST /api/payment/create", () => {
  it("returns only what the checkout needs — no secret", async () => {
    const o = await newPaidFlowOrder();
    expect(o.status).toBe(200);
    expect(o.checkout).toMatchObject({ provider: "cashfree", mode: "sandbox", amount: 299, currency: "INR", orderRef: o.ref });
    expect(o.checkout.paymentSessionId).toBeTruthy();
    expect(JSON.stringify(o.checkout)).not.toContain("cf_test_secret");
    expect(cf.orders.get(o.ref)?.order_id).toBe(o.ref);
  });

  it("requires the order's own token", async () => {
    const o = await newPaidFlowOrder();
    const create = await import("@/app/api/payment/create/route");
    const res = await create.POST(jsonReq("/api/payment/create", { orderId: o.ref }, { "x-order-token": "A".repeat(43) }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/payment/webhook", () => {
  it("successful payment → PAID, one payment record, one translation job, 'being prepared' email", async () => {
    const o = await newPaidFlowOrder("fr");
    const r = await sendWebhook(successBody(o.ref));
    expect(r).toEqual({ status: 200, body: { ok: true, message: "Payment recorded" } });
    const row = await order(o.ref);
    expect(row.payment_status).toBe("PAID");
    expect(row.fulfillment_status).toBe("PROCESSING");
    expect(await count("SELECT COUNT(*) n FROM payments WHERE order_id = ?", row.id)).toBe(1);
    expect(await count("SELECT COUNT(*) n FROM translation_jobs WHERE cache_key = ?", await itemKey(row.id))).toBe(1);
    const { sentEmailsForTests } = await import("@/lib/server/emailService");
    expect(sentEmailsForTests.some((e) => e.subject.includes("being prepared") && e.text.includes(o.ref))).toBe(true);
  });

  it("duplicate webhooks (same payment) are ignored safely", async () => {
    const o = await newPaidFlowOrder("es");
    const body = successBody(o.ref); // one payment, reused across deliveries
    expect((await sendWebhook(body)).body.message).toBe("Payment recorded");
    expect((await sendWebhook(body)).body.message).toBe("Duplicate ignored");
    expect((await sendWebhook(body)).body.message).toBe("Duplicate ignored");
    const row = await order(o.ref);
    expect(await count("SELECT COUNT(*) n FROM payments WHERE order_id = ?", row.id)).toBe(1);
    expect(await count("SELECT COUNT(*) n FROM translation_jobs WHERE cache_key = ?", await itemKey(row.id))).toBe(1);
  });

  it("rejects an invalid signature and leaves the order unpaid", async () => {
    const o = await newPaidFlowOrder();
    const body = successBody(o.ref);
    expect((await sendWebhook(body, signWebhook(body, WEBHOOK_TS, "wrong-secret"))).status).toBe(400);
    expect((await sendWebhook(body, "")).status).toBe(400);
    expect((await sendWebhook(body + " ", signWebhook(body))).status).toBe(400); // tampered body
    expect((await sendWebhook(body, signWebhook(body, "9999999999"))).status).toBe(400); // wrong timestamp
    expect((await order(o.ref)).payment_status).toBe("PENDING");
  });

  it("does not mark paid when the amount is wrong", async () => {
    const o = await newPaidFlowOrder();
    const body = webhookBody("PAYMENT_SUCCESS_WEBHOOK", cf.pay(o.ref, 1), cf.orders.get(o.ref)!); // ₹1 instead of ₹299
    expect((await sendWebhook(body)).body.message).toBe("Amount mismatch");
    expect((await order(o.ref)).payment_status).toBe("PENDING");
  });

  it("does not mark paid when the currency is wrong", async () => {
    const o = await newPaidFlowOrder();
    const body = webhookBody("PAYMENT_SUCCESS_WEBHOOK", { ...cf.pay(o.ref), payment_currency: "USD" }, cf.orders.get(o.ref)!);
    expect((await sendWebhook(body)).body.message).toBe("Amount mismatch");
    expect((await order(o.ref)).payment_status).toBe("PENDING");
  });

  it("does not mark paid if the gateway API does not confirm it", async () => {
    const o = await newPaidFlowOrder();
    // Correctly signed (e.g. leaked secret / replay), amount matches, but the gateway order is NOT paid.
    const forged = { cf_payment_id: 987654, order_id: o.ref, payment_status: "SUCCESS", payment_amount: 299, payment_currency: "INR" };
    const body = webhookBody("PAYMENT_SUCCESS_WEBHOOK", forged, cf.orders.get(o.ref)!);
    expect((await sendWebhook(body)).body.message).toBe("Not confirmed by gateway");
    expect((await order(o.ref)).payment_status).toBe("PENDING");
  });

  it("failed payment → FAILED, no fulfillment", async () => {
    const o = await newPaidFlowOrder();
    const failed = { cf_payment_id: 111, order_id: o.ref, payment_status: "FAILED", payment_amount: 299, payment_currency: "INR" };
    expect((await sendWebhook(webhookBody("PAYMENT_FAILED_WEBHOOK", failed, cf.orders.get(o.ref)!))).body.message).toBe("Payment failure recorded");
    const row = await order(o.ref);
    expect(row.payment_status).toBe("FAILED");
    expect(row.fulfillment_status).toBe("NOT_STARTED");
  });

  it("user-dropped (cancelled) payment → FAILED, no fulfillment", async () => {
    const o = await newPaidFlowOrder();
    const dropped = { cf_payment_id: 222, order_id: o.ref, payment_status: "USER_DROPPED", payment_amount: 299, payment_currency: "INR" };
    expect((await sendWebhook(webhookBody("PAYMENT_USER_DROPPED_WEBHOOK", dropped, cf.orders.get(o.ref)!))).body.message).toBe("Payment failure recorded");
    expect((await order(o.ref)).payment_status).toBe("FAILED");
  });

  it("no webhook at all → stays PENDING and cannot be downloaded", async () => {
    const o = await newPaidFlowOrder();
    expect((await order(o.ref)).payment_status).toBe("PENDING");
    const { GET } = await import("@/app/api/orders/[orderId]/download/route");
    const res = await GET(getReq(`/api/orders/${o.ref}/download`, { "x-order-token": o.token }), { params: Promise.resolve({ orderId: o.ref }) });
    expect(res.status).toBe(402);
  });

  it("gateway outage during webhook → 503 (gateway retries), then succeeds idempotently", async () => {
    const o = await newPaidFlowOrder("de");
    const body = successBody(o.ref);
    cf.setDown(true);
    expect((await sendWebhook(body)).status).toBe(503);
    expect((await order(o.ref)).payment_status).toBe("PENDING");
    cf.setDown(false);
    expect((await sendWebhook(body)).body.message).toBe("Payment recorded");
    expect((await order(o.ref)).payment_status).toBe("PAID");
  });
});

describe("Frontend cannot mark an order paid", () => {
  it("/api/payment/verify asks the gateway; an unpaid order stays PENDING", async () => {
    const o = await newPaidFlowOrder();
    const { POST } = await import("@/app/api/payment/verify/route");
    const res = await POST(jsonReq("/api/payment/verify", { orderId: o.ref, paymentStatus: "PAID", cf_payment_id: "fake" }, { "x-order-token": o.token }));
    expect((await res.json()).paymentStatus).toBe("PENDING");
  });

  it("/api/payment/verify confirms a really-paid order via the gateway API", async () => {
    const o = await newPaidFlowOrder("ja");
    cf.pay(o.ref);
    const { POST } = await import("@/app/api/payment/verify/route");
    const res = await POST(jsonReq("/api/payment/verify", { orderId: o.ref }, { "x-order-token": o.token }));
    expect((await res.json()).paymentStatus).toBe("PAID");
  });
});
