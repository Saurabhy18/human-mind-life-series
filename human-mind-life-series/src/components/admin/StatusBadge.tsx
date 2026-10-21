import { STATUS_LABELS, type OrderStatus } from "@/lib/order-status";

const STYLES: Record<OrderStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  verified: "bg-sky-50 text-sky-800 ring-sky-200",
  rejected: "bg-red-50 text-red-800 ring-red-200",
  delivered: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Formats UTC timestamp in Indian Standard Time (IST). */
export function formatDate(utcStr: string | null): string {
  if (!utcStr) return "—";
  return new Date(utcStr.includes("T") ? utcStr : (utcStr.replace(" ", "T") + "Z")).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
