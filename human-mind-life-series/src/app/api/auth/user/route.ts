import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { success: true, authenticated: false, user: null },
        { status: 200 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: profile?.role || "user",
        fullName: profile?.full_name || user.user_metadata?.full_name || "",
        createdAt: profile?.created_at || user.created_at,
      },
    });
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
