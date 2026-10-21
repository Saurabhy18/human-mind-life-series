import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/server/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const hasAuthCookie = cookieStore.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
    if (!hasAuthCookie) {
      return NextResponse.json(
        { success: true, authenticated: false, user: null },
        {
          status: 200,
          headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
        }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { success: true, authenticated: false, user: null },
        {
          status: 200,
          headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
        }
      );
    }

    let profile: { id?: string; email?: string; full_name?: string; role?: string; created_at?: string } | null = null;
    try {
      profile = (getDb().prepare("SELECT id, email, full_name, role, created_at FROM profiles WHERE id = ?").get(user.id) as any) ?? null;
    } catch {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, created_at, updated_at")
        .eq("id", user.id)
        .maybeSingle();
      profile = data ?? null;
    }

    return NextResponse.json(
      {
        success: true,
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          role: profile?.role || "user",
          fullName: profile?.full_name || user.user_metadata?.full_name || "",
          createdAt: profile?.created_at || user.created_at,
        },
      },
      {
        headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
