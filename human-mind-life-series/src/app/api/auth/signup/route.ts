import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please provide a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  fullName: z.string().trim().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = signupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password, fullName } = result.data;
    const supabase = await createClient();

    // Default role 'user' strictly enforced
    const DEFAULT_ROLE = "user";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || "",
          role: DEFAULT_ROLE,
        },
      },
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { success: false, error: "Could not register user." },
        { status: 500 }
      );
    }

    // Ensure profile row exists with role 'user'
    try {
      const adminClient = createAdminClient();
      await adminClient.from("profiles").upsert(
        {
          id: data.user.id,
          email: data.user.email || email,
          full_name: fullName || "",
          role: DEFAULT_ROLE,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id", ignoreDuplicates: false }
      );
    } catch {
      // Database trigger automatically ensures insertion
    }

    return NextResponse.json({
      success: true,
      requiresVerification: !data.session,
      message: !data.session
        ? "Account created! Please check your email to verify your account."
        : "Account created successfully!",
      user: {
        id: data.user.id,
        email: data.user.email,
        role: DEFAULT_ROLE,
        fullName: fullName || "",
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
