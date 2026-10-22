import { redirect } from "next/navigation";

// The old combined dashboard is now split into /profile and /orders.
export default function DashboardRedirect() {
  redirect("/profile");
}
