import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const STORAGE = () => (globalThis as unknown as { __TEST_STORAGE__: string }).__TEST_STORAGE__;
export const ORIGIN = "https://shop.example.com";

/** A small source book shaped like the real ones: image cover, running header, headings, paragraphs, lists. */
export async function writeSourceBook(slug: string, opts: { pages?: number; marker?: string } = {}): Promise<string> {
  const doc = await PDFDocument.create();
  doc.setTitle("TEST BOOK");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 432;
  const H = 649;

  // Cover: graphics only, no text → copied unchanged into translations.
  const cover = doc.addPage([W, H]);
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.15, 0.12, 0.25) });
  cover.drawEllipse({ x: 300, y: 450, xScale: 50, yScale: 50, color: rgb(0.9, 0.7, 0.4) });

  const body = [
    "Intimacy does not have an expiration date. This line wraps onto",
    "a second line, so the parser must join the lines into one paragraph.",
  ];
  const pages = opts.pages ?? 3;
  for (let p = 1; p <= pages; p++) {
    const page = doc.addPage([W, H]);
    page.drawText(`Test Author | Test Book | ${p + 1}`, { x: 135, y: 39, size: 8, font });
    page.drawText(`Chapter ${p} - Beginnings ${opts.marker ?? ""}`.trim(), { x: 51, y: 577, size: 20, font: bold });
    page.drawText("Learning Objectives", { x: 51, y: 540, size: 12.5, font: bold });
    page.drawText("•", { x: 51, y: 520, size: 10.5, font });
    page.drawText("Understand how intimacy can evolve after fifty.", { x: 69, y: 520, size: 10.5, font });
    page.drawText("•", { x: 51, y: 504, size: 10.5, font });
    page.drawText("Use clearer communication about comfort, consent,", { x: 69, y: 504, size: 10.5, font });
    page.drawText("preferences, and boundaries.", { x: 69, y: 488, size: 10.5, font });
    page.drawText(body[0], { x: 63, y: 460, size: 10.5, font });
    page.drawText(body[1], { x: 51, y: 444, size: 10.5, font });
    page.drawText("A second paragraph starts with an indent and ends here.", { x: 63, y: 421, size: 10.5, font });
    page.drawText("1. What idea in this chapter challenged an assumption?", { x: 51, y: 395, size: 10.5, font });
    page.drawText("2. Which part feels most relevant to everyday life?", { x: 51, y: 379, size: 10.5, font });
  }
  const file = path.join(STORAGE(), "books", `${slug}.pdf`);
  fs.writeFileSync(file, await doc.save());
  return file;
}

// Each request comes from a different (fake) IP so per-IP rate limits don't interfere with tests.
let ipCounter = 0;
const nextIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

export function jsonReq(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, host: "shop.example.com", "x-forwarded-for": nextIp(), ...headers },
    body: JSON.stringify(body),
  });
}

export function getReq(url: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${url}`, { headers: { host: "shop.example.com", "x-forwarded-for": nextIp(), ...headers } });
}

/** Cashfree webhook signature: Base64( HMAC-SHA256( secret, timestamp + rawBody ) ). */
export const WEBHOOK_TS = "1700000000";
export function signWebhook(body: string, timestamp = WEBHOOK_TS, secret = "cf_test_secret"): string {
  return crypto.createHmac("sha256", secret).update(timestamp + body).digest("base64");
}

/** A tiny but valid PNG (for UPI payment screenshots). */
export function pngBytes(): Uint8Array {
  return new Uint8Array(
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
  );
}

export type CfOrder = { cf_order_id: string; order_id: string; order_amount: number; order_currency: string; order_status: string; payment_session_id: string };
export type CfPayment = { cf_payment_id: number; order_id: string; payment_status: string; payment_amount: number; payment_currency: string };

/**
 * Mock of the Cashfree PG REST API (create order, get order, get order payments).
 * Tests flip an order to "PAID" to simulate the customer paying at the gateway.
 * The order id is OUR own order ref (we supply it when creating the Cashfree order).
 */
export function mockCashfree() {
  const orders = new Map<string, CfOrder>();
  const payments = new Map<string, CfPayment[]>();
  let n = 0;
  let down = false;
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith("https://cf.test")) return original(input, init);
    if (down) throw new Error("ECONNRESET");
    const h = new Headers(init?.headers);
    if (h.get("x-client-id") !== "cf_test_client" || h.get("x-client-secret") !== "cf_test_secret" || !h.get("x-api-version")) {
      return new Response(JSON.stringify({ message: "authentication failed" }), { status: 401 });
    }
    const u = new URL(url);
    if (init?.method === "POST" && u.pathname === "/pg/orders") {
      const body = JSON.parse(String(init.body));
      const o: CfOrder = {
        cf_order_id: `cf_${++n}`,
        order_id: body.order_id,
        order_amount: body.order_amount,
        order_currency: body.order_currency,
        order_status: "ACTIVE",
        payment_session_id: `session_${body.order_id}_${n}`,
      };
      orders.set(o.order_id, o);
      return Response.json(o);
    }
    const m = u.pathname.match(/^\/pg\/orders\/([^/]+)(\/payments)?$/);
    if (m) {
      const o = orders.get(decodeURIComponent(m[1]));
      if (!o) return new Response(JSON.stringify({ message: "order not found" }), { status: 404 });
      return m[2] ? Response.json(payments.get(o.order_id) ?? []) : Response.json(o);
    }
    return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
  }) as typeof fetch;

  return {
    orders,
    setDown(v: boolean) {
      down = v;
    },
    /** Simulates a successful payment at the gateway; returns the payment entity. */
    pay(orderRef: string, amount?: number) {
      const o = orders.get(orderRef)!;
      const p: CfPayment = { cf_payment_id: ++n, order_id: o.order_id, payment_status: "SUCCESS", payment_amount: amount ?? o.order_amount, payment_currency: o.order_currency };
      if (p.payment_amount === o.order_amount) o.order_status = "PAID";
      payments.set(o.order_id, [...(payments.get(o.order_id) ?? []), p]);
      return p;
    },
    restore() {
      globalThis.fetch = original;
    },
  };
}

/** Builds a Cashfree webhook body (type + { data: { order, payment } }). */
export function webhookBody(type: string, payment: CfPayment, order: Pick<CfOrder, "order_id" | "order_amount" | "order_currency">) {
  return JSON.stringify({
    type,
    data: {
      order: { order_id: order.order_id, order_amount: order.order_amount, order_currency: order.order_currency },
      payment,
    },
    event_time: new Date().toISOString(),
  });
}
