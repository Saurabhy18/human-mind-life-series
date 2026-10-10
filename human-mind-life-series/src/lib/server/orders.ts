import "server-only";
import crypto from "node:crypto";
import { getDb } from "./db";
import type { OrderStatus } from "@/lib/order-status";
import { getProduct } from "@/lib/products";

export type Order = {
  id: number;
  ref: string;
  product_slug: string;
  product_title: string;
  /** Price of the product at the time of the order (from the server catalogue). */
  amount: number;
  /** Amount the customer says they paid. Compare with your bank statement. */
  amount_paid: number | null;
  author: string | null;
  buyer_name: string;
  email: string;
  whatsapp: string;
  utr: string;
  screenshot_file: string;
  screenshot_mime: string;
  status: OrderStatus;
  admin_note: string | null;
  utm_json: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
  delivered_at: string | null;
  // Multilingual delivery
  source_language: string;
  target_language: string;
  currency: string;
  customer_id: number | null;
  payment_status: PaymentStatus;
  payment_provider: string;
  provider_order_id: string | null;
  paid_at: string | null;
  fulfillment_status: FulfillmentStatus;
  cache_key: string | null;
  translated_book_id: number | null;
  access_expires_at: string | null;
  download_count: number;
  ready_email_sent_at: string | null;
  processing_email_sent_at: string | null;
};

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type FulfillmentStatus = "NOT_STARTED" | "PROCESSING" | "COMPLETED" | "FAILED";

/** Finds an order by its public reference (e.g. HM-7KQ2M9XA). */
export function getOrderByRef(ref: string): Order | undefined {
  return getDb().prepare("SELECT * FROM orders WHERE ref = ?").get(ref) as Order | undefined;
}

/** Author(s) of the ordered book. Falls back to the catalogue for orders saved before this was stored. */
export function orderAuthor(o: Pick<Order, "author" | "product_slug">): string {
  return o.author ?? getProduct(o.product_slug)?.author ?? "";
}

/** True when the customer-entered amount differs from the expected price. */
export function amountMismatch(o: Pick<Order, "amount" | "amount_paid">): boolean {
  return o.amount_paid != null && Math.abs(o.amount_paid - o.amount) > 0.001;
}

export type OrderEvent = { id: number; order_id: number; status: string; note: string | null; created_at: string };

export type Message = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  topic: string;
  message: string;
  handled: number;
  created_at: string;
};

// Unambiguous characters (no 0/O, 1/I/L) so customers can read references aloud.
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateOrderRef(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += REF_ALPHABET[crypto.randomInt(REF_ALPHABET.length)];
  return `HM-${out}`;
}

export type NewOrder = Pick<
  Order,
  | "product_slug"
  | "product_title"
  | "amount"
  | "amount_paid"
  | "author"
  | "buyer_name"
  | "email"
  | "whatsapp"
  | "utr"
  | "screenshot_file"
  | "screenshot_mime"
  | "utm_json"
  | "ip_hash"
  | "user_agent"
  | "source_language"
  | "target_language"
  | "currency"
  | "payment_provider"
> & { customer_id?: number | null; provider_order_id?: string | null };

/** Creates or updates the customer record for an email address (one row per customer). */
export function upsertCustomer(c: { email: string; name: string; whatsapp?: string | null }): number {
  const db = getDb();
  db.prepare(`
    INSERT INTO customers (email, name, whatsapp) VALUES (@email, @name, @whatsapp)
    ON CONFLICT(email) DO UPDATE SET name = excluded.name, whatsapp = COALESCE(excluded.whatsapp, customers.whatsapp), updated_at = datetime('now')
  `).run({ email: c.email, name: c.name, whatsapp: c.whatsapp ?? null });
  return (db.prepare("SELECT id FROM customers WHERE email = ?").get(c.email) as { id: number }).id;
}

export function utrExists(utr: string): boolean {
  return !!getDb().prepare("SELECT 1 FROM orders WHERE utr = ? COLLATE NOCASE").get(utr);
}

export function createOrder(data: NewOrder): { id: number; ref: string } {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO orders (ref, product_slug, product_title, amount, amount_paid, author, buyer_name, email, whatsapp, utr,
                        screenshot_file, screenshot_mime, utm_json, ip_hash, user_agent,
                        source_language, target_language, currency, payment_provider, customer_id, provider_order_id)
    VALUES (@ref, @product_slug, @product_title, @amount, @amount_paid, @author, @buyer_name, @email, @whatsapp, @utr,
            @screenshot_file, @screenshot_mime, @utm_json, @ip_hash, @user_agent,
            @source_language, @target_language, @currency, @payment_provider, @customer_id, @provider_order_id)
  `);
  const event = db.prepare("INSERT INTO order_events (order_id, status, note) VALUES (?, 'pending', 'Payment details submitted by customer')");

  return db.transaction(() => {
    // Retry on the (very unlikely) event of a reference collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const ref = generateOrderRef();
      try {
        const res = insert.run({ customer_id: null, provider_order_id: null, ...data, ref });
        const id = Number(res.lastInsertRowid);
        event.run(id);
        return { id, ref };
      } catch (err) {
        if (err instanceof Error && err.message.includes("orders.ref")) continue;
        throw err;
      }
    }
    throw new Error("Could not generate a unique order reference");
  })();
}

export type OrderFilter = { status?: OrderStatus; q?: string };

export function listOrders(filter: OrderFilter = {}): Order[] {
  const where: string[] = [];
  const params: Record<string, string> = {};
  if (filter.status) {
    where.push("status = @status");
    params.status = filter.status;
  }
  if (filter.q) {
    where.push("(buyer_name LIKE @q OR email LIKE @q OR whatsapp LIKE @q OR utr LIKE @q OR ref LIKE @q)");
    params.q = `%${filter.q}%`;
  }
  const sql = `SELECT * FROM orders ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT 500`;
  return getDb().prepare(sql).all(params) as Order[];
}

export function countOrdersByStatus(): Record<OrderStatus | "all", number> {
  const rows = getDb().prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status").all() as {
    status: OrderStatus;
    n: number;
  }[];
  const counts = { all: 0, pending: 0, verified: 0, rejected: 0, delivered: 0 };
  for (const r of rows) {
    counts[r.status] = r.n;
    counts.all += r.n;
  }
  return counts;
}

export function getOrder(id: number): Order | undefined {
  return getDb().prepare("SELECT * FROM orders WHERE id = ?").get(id) as Order | undefined;
}

export function getOrderEvents(orderId: number): OrderEvent[] {
  return getDb().prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY id DESC").all(orderId) as OrderEvent[];
}

export function updateOrderStatus(id: number, status: OrderStatus, note: string | null): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare(`
      UPDATE orders SET
        status = @status,
        admin_note = COALESCE(@note, admin_note),
        updated_at = datetime('now'),
        verified_at  = CASE WHEN @status IN ('verified','delivered') AND verified_at IS NULL THEN datetime('now') ELSE verified_at END,
        delivered_at = CASE WHEN @status = 'delivered' AND delivered_at IS NULL THEN datetime('now') ELSE delivered_at END
      WHERE id = @id
    `).run({ id, status, note });
    db.prepare("INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)").run(id, status, note);
  })();
}

export function createMessage(m: Omit<Message, "id" | "handled" | "created_at">): void {
  getDb()
    .prepare("INSERT INTO messages (name, email, phone, topic, message) VALUES (@name, @email, @phone, @topic, @message)")
    .run(m);
}

export function listMessages(): Message[] {
  return getDb().prepare("SELECT * FROM messages ORDER BY handled ASC, id DESC LIMIT 500").all() as Message[];
}

export function countUnhandledMessages(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM messages WHERE handled = 0").get() as { n: number }).n;
}

export function setMessageHandled(id: number, handled: boolean): void {
  getDb().prepare("UPDATE messages SET handled = ? WHERE id = ?").run(handled ? 1 : 0, id);
}
