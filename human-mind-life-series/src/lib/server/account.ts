import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrdersByEmail, type Order } from "@/lib/server/orders";

/** Loads the signed-in user and their profile row, or sends them to log in and come back to `returnTo`. */
export async function requireAccount(returnTo: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    role: (profile?.role as string | undefined) || "user",
    fullName: profile?.full_name || user.user_metadata?.full_name || "Book Reader",
    createdAt: (profile?.created_at as string | undefined) || user.created_at,
  };
}

/** Orders placed with this email, newest first. Falls back to the local store if Supabase has none. */
export async function getUserOrders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string | undefined,
): Promise<Order[]> {
  if (!email) return [];
  try {
    const { data: ords, error } = await supabase
      .from("orders")
      .select("*")
      .ilike("email", email)
      .order("id", { ascending: false });

    if (!error && ords && ords.length > 0) return ords as Order[];
    return getOrdersByEmail(email);
  } catch {
    try {
      return getOrdersByEmail(email);
    } catch {
      return [];
    }
  }
}
