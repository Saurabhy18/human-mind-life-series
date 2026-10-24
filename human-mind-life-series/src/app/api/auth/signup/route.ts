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

    // Default role 'user' strictly enforced
    const DEFAULT_ROLE = "user";

    /**
     * Registration deliberately skips email verification.
     *
     * `auth.signUp()` is not used here: while the project has "Confirm email"
     * switched on it sends a confirmation message on every attempt, which both
     * withholds the session and burns the built-in mail quota — once that quota
     * is spent, signup fails outright with "email rate limit exceeded". No
     * transactional mail is configured, so the link would never arrive anyway.
     *
     * Creating the account with the service role sends no mail and marks the
     * address confirmed, so the user can sign in straight away. This behaves
     * the same whether or not "Confirm email" is enabled on the project.
     */
    const { data: created, error } = await createAdminClient().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || "",
        role: DEFAULT_ROLE,
      },
    });

    if (error) {
      // Supabase reports an existing address as "already been registered".
      const taken = error.message.toLowerCase().includes("already");
      return NextResponse.json(
        {
          success: false,
          error: taken
            ? "An account with this email already exists. Please sign in instead."
            : error.message,
        },
        { status: 400 }
      );
    }

    if (!created.user) {
      return NextResponse.json(
        { success: false, error: "Could not register user." },
        { status: 500 }
      );
    }

    // Establish the browser session for the account just created.
    const supabase = await createClient();
    await supabase.auth.signInWithPassword({ email, password });

    // Ensure profile row exists with role 'user'
    try {
      const adminClient = createAdminClient();
      await adminClient.from("profiles").upsert(
        {
          id: created.user.id,
          email: created.user.email || email,
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
      requiresVerification: false,
      message: "Account created successfully!",
      user: {
        id: created.user.id,
        email: created.user.email,
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
