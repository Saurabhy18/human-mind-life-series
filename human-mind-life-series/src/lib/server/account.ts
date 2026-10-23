import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrdersByEmail, type Order } from "@/lib/server/orders";
import { getDb } from "@/lib/server/db";

/**
 * Loads the signed-in user and their profile row, or sends them to log in and come back to `returnTo`.
 * Enforces that user protected routes (such as /orders and /dashboard) are not accessible to users with a diff role (admin).
 */
export const requireAccount = cache(async (returnTo: string) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  let profileRole: string | undefined;
  let fullName = user.user_metadata?.full_name || "Book Reader";
  let createdAt = user.created_at;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      profileRole = profile.role;
      if (profile.full_name) fullName = profile.full_name;
      if (profile.created_at) createdAt = profile.created_at;
    }
  } catch {}

  if (!profileRole) {
    try {
      const local = getDb()
        .prepare("SELECT * FROM profiles WHERE id = ?")
        .get(user.id) as { role?: string; full_name?: string; created_at?: string } | undefined;
      if (local) {
        profileRole = local.role;
        if (local.full_name) fullName = local.full_name;
        if (local.created_at) createdAt = local.created_at;
      }
    } catch {}
  }

  const role = profileRole || user.app_metadata?.role || "user";

  // Prevent admin from accessing regular user customer routes like /orders or /dashboard
  if ((returnTo.startsWith("/orders") || returnTo.startsWith("/dashboard")) && role === "admin") {
    redirect("/admin");
  }

  return {
    supabase,
    user,
    role,
    fullName,
    createdAt,
  };
});

/** Orders placed with this email, newest first. Falls back to the local store if Supabase has none. */
export async function getUserOrders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string | undefined,
): Promise<Order[]> {
  if (!email) return [];
  // Direct database query ensures immediate consistency with admin verifications
  const dbOrders = getOrdersByEmail(email);
  if (dbOrders && dbOrders.length > 0) return dbOrders;
  try {
    const { data: ords, error } = await supabase
      .from("orders")
      .select("*")
      .ilike("email", email)
      .order("id", { ascending: false });

    if (!error && ords && ords.length > 0) return ords as Order[];
    return [];
  } catch {
    return [];
  }
}
