/** Statuses for FREE book requests — separate from paid order statuses. */
export const FREE_STATUSES = ["received", "sent", "completed"] as const;
export type FreeStatus = (typeof FREE_STATUSES)[number];

export const FREE_STATUS_LABELS: Record<FreeStatus, string> = {
  received: "Free Request Received",
  sent: "Free Book Sent",
  completed: "Completed",
};

export function isFreeStatus(value: unknown): value is FreeStatus {
  return typeof value === "string" && (FREE_STATUSES as readonly string[]).includes(value);
}
