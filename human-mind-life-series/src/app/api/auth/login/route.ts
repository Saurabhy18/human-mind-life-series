import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Confirms an unverified address with the service role and retries the sign-in.
 *
 * Email verification is not used by this site (see the signup route), but
 * accounts registered while "Confirm email" was on are stuck: Supabase refuses
 * the password grant with "Email not confirmed" and no transactional mail is
 * configured to deliver the link. Confirm on demand so those accounts recover
 * on their next sign-in attempt rather than needing manual intervention.
 */
async function confirmAndRetry(email: string, password: string) {
  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers();
  const user = list?.users.find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase()
  );
  if (!user) return null;

  await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
  return createClient().then((client) =>
    client.auth.signInWithPassword({ email, password })
  );
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please provide a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);

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

    const { email, password } = result.data;
    const supabase = await createClient();

    let { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error?.message.toLowerCase().includes("email not confirmed")) {
      const retried = await confirmAndRetry(email, password);
      if (retried) ({ data, error } = retried);
    }

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { success: false, error: "Login failed." },
        { status: 401 }
      );
    }

    // Get user profile role from database
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", data.user.id)
      .maybeSingle();

    const role = profile?.role || "user";

    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        id: data.user.id,
        email: data.user.email,
        role,
        fullName: profile?.full_name || data.user.user_metadata?.full_name || "",
      },
      session: data.session,
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
