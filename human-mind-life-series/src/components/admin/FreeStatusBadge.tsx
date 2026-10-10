import { FREE_STATUS_LABELS, type FreeStatus } from "@/lib/free-status";

const STYLES: Record<FreeStatus, string> = {
  received: "bg-amber-50 text-amber-800 ring-amber-200",
  sent: "bg-sky-50 text-sky-800 ring-sky-200",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

export function FreeStatusBadge({ status }: { status: FreeStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${STYLES[status]}`}>
      {FREE_STATUS_LABELS[status]}
    </span>
  );
}
