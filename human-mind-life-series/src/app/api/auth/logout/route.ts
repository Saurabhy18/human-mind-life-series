import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { destroySession } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    // Clear both ways of being signed in: the password-based admin cookie and the Supabase account session.
    await destroySession();
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.json({ success: true, message: "Logged out successfully" });
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
