export const ORDER_STATUSES = ["pending", "verified", "rejected", "delivered"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending Verification",
  verified: "Payment Verified",
  rejected: "Payment Rejected",
  delivered: "Book Delivered",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}
