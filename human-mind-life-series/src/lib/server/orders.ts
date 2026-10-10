import "server-only";
import crypto from "node:crypto";
import { getDb } from "./db";
import type { OrderStatus } from "@/lib/order-status";
import type { PackageId } from "@/config/packages";
import { getProduct } from "@/lib/products";

export type Order = {
  id: number;
  ref: string;
  /** individual / three_book_bundle / five_book_bundle — the books themselves are in order_items. */
  package_type: PackageId;
  /** The book's slug for an individual order, the package id for a bundle. */
  product_slug: string;
  /** e.g. "Volume 4 — Intimacy After 50", or "3 Book Bundle — Volumes 1, 3, 5". */
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
  /** Language of the first ebook (each ebook's own language is in order_items). */
  target_language: string;
  currency: string;
  customer_id: number | null;
  payment_status: PaymentStatus;
  payment_provider: string;
  provider_order_id: string | null;
  paid_at: string | null;
  /** Summary of the order's ebooks (see refreshOrderFulfillment). */
  fulfillment_status: FulfillmentStatus;
  // The next four are kept for orders placed before packages; order_items holds them per ebook now.
  cache_key: string | null;
  translated_book_id: number | null;
  access_expires_at: string | null;
  download_count: number;
  ready_email_sent_at: string | null;
  processing_email_sent_at: string | null;
};

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type FulfillmentStatus = "NOT_STARTED" | "PROCESSING" | "COMPLETED" | "FAILED";

/** One ebook in an order, in the language the customer chose for it. */
export type OrderItem = {
  id: number;
  order_id: number;
  position: number;
  book_slug: string;
  book_title: string;
  author: string | null;
  source_language: string;
  target_language: string;
  fulfillment_status: FulfillmentStatus;
  /** Translation cache key (book + source + target + source version) once delivery has started. */
  cache_key: string | null;
  /** The delivered PDF (translated_books row). */
  translated_book_id: number | null;
  download_count: number;
  access_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NewOrderItem = Pick<OrderItem, "book_slug" | "book_title" | "author" | "source_language" | "target_language">;

/** Finds an order by its public reference (e.g. HM-7KQ2M9XA). */
export function getOrderByRef(ref: string): Order | undefined {
  return getDb().prepare("SELECT * FROM orders WHERE ref = ?").get(ref) as Order | undefined;
}

export function getOrderItems(orderId: number): OrderItem[] {
  return getDb().prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY position, id").all(orderId) as OrderItem[];
}

/** The ebooks of many orders in one query (admin lists and exports). */
export function itemsForOrders(orderIds: number[]): Map<number, OrderItem[]> {
  const out = new Map<number, OrderItem[]>();
  if (!orderIds.length) return out;
  const rows = getDb().prepare("SELECT * FROM order_items WHERE order_id IN (SELECT value FROM json_each(?)) ORDER BY order_id, position, id").all(JSON.stringify(orderIds)) as OrderItem[];
  for (const r of rows) out.set(r.order_id, [...(out.get(r.order_id) ?? []), r]);
  return out;
}

/** An item only if it belongs to this order (so one order's token can never reach another order's book). */
export function getOrderItem(orderId: number, itemId: number): OrderItem | undefined {
  return getDb().prepare("SELECT * FROM order_items WHERE id = ? AND order_id = ?").get(itemId, orderId) as OrderItem | undefined;
}

/** Author(s) of the ordered book(s). Falls back to the catalogue for orders saved before this was stored. */
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
> & {
  customer_id?: number | null;
  provider_order_id?: string | null;
  /** Defaults to "individual". */
  package_type?: PackageId;
  /** The ebooks and their languages. Defaults to the single book in product_slug / target_language. */
  items?: NewOrderItem[];
};

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

/** Creates the order and its ebooks in one transaction (an order never exists without its items). */
export function createOrder(data: NewOrder): { id: number; ref: string } {
  const db = getDb();
  const { items: givenItems, ...order } = data;
  const items: NewOrderItem[] = givenItems?.length
    ? givenItems
    : [{ book_slug: data.product_slug, book_title: data.product_title, author: data.author, source_language: data.source_language, target_language: data.target_language }];
  const insert = db.prepare(`
    INSERT INTO orders (ref, package_type, product_slug, product_title, amount, amount_paid, author, buyer_name, email, whatsapp, utr,
                        screenshot_file, screenshot_mime, utm_json, ip_hash, user_agent,
                        source_language, target_language, currency, payment_provider, customer_id, provider_order_id)
    VALUES (@ref, @package_type, @product_slug, @product_title, @amount, @amount_paid, @author, @buyer_name, @email, @whatsapp, @utr,
            @screenshot_file, @screenshot_mime, @utm_json, @ip_hash, @user_agent,
            @source_language, @target_language, @currency, @payment_provider, @customer_id, @provider_order_id)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, position, book_slug, book_title, author, source_language, target_language)
    VALUES (@order_id, @position, @book_slug, @book_title, @author, @source_language, @target_language)
  `);
  const event = db.prepare("INSERT INTO order_events (order_id, status, note) VALUES (?, 'pending', 'Payment details submitted by customer')");

  return db.transaction(() => {
    // Retry on the (very unlikely) event of a reference collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const ref = generateOrderRef();
      try {
        const res = insert.run({ customer_id: null, provider_order_id: null, package_type: "individual", ...order, ref });
        const id = Number(res.lastInsertRowid);
        items.forEach((item, position) => insertItem.run({ ...item, author: item.author ?? null, order_id: id, position }));
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
