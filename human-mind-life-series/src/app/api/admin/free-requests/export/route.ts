import { isAdmin } from "@/lib/server/auth";
import { listFreeRequests } from "@/lib/server/free-requests";
import { FREE_STATUS_LABELS } from "@/lib/free-status";

export const runtime = "nodejs";

function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  // Prevent spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });

  const header = ["Request Ref", "Request Date (UTC)", "Name", "Email", "WhatsApp", "Book", "Author", "Delivery Status", "Link Downloads", "Note", "Source"];
  const rows = listFreeRequests().map((r) => {
    const utm = r.utm_json ? (JSON.parse(r.utm_json) as Record<string, string>) : {};
    const source = [utm.utm_source, utm.utm_medium, utm.utm_campaign].filter(Boolean).join(" / ");
    return [r.ref, r.created_at, r.name, r.email, r.whatsapp, r.book_title, r.author, FREE_STATUS_LABELS[r.status], r.download_count, r.admin_note, source];
  });
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="free-requests-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
