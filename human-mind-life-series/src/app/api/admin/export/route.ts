import { isAdmin } from "@/lib/server/auth";
import { itemsForOrders, listOrders, orderAuthor } from "@/lib/server/orders";
import { STATUS_LABELS } from "@/lib/order-status";

export const runtime = "nodejs";

function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  // Prevent spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });

  const header = ["Order Ref", "Date (UTC)", "Customer", "Email", "WhatsApp", "Package", "Book", "Ebooks (language)", "Author", "Price", "Amount Paid", "Currency", "UTR", "Status", "Note", "Source"];
  const orders = listOrders();
  const items = itemsForOrders(orders.map((o) => o.id));
  const rows = orders.map((o) => {
    const utm = o.utm_json ? (JSON.parse(o.utm_json) as Record<string, string>) : {};
    const source = [utm.utm_source, utm.utm_medium, utm.utm_campaign].filter(Boolean).join(" / ");
    const ebooks = (items.get(o.id) ?? []).map((i) => `${i.book_title} (${i.target_language})`).join("; ");
    return [o.ref, o.created_at, o.buyer_name, o.email, o.whatsapp, o.package_type, o.product_title, ebooks, orderAuthor(o), o.amount, o.amount_paid, o.currency, o.utr, STATUS_LABELS[o.status], o.admin_note, source];
  });
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
