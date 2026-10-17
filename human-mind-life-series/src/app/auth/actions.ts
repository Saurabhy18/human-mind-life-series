"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthState = {
  success?: boolean;
  error?: string;
  message?: string;
  requiresVerification?: boolean;
  user?: {
    id: string;
    email?: string;
    role: string;
    fullName?: string;
  };
};

/**
 * Enforces default role 'user' for anyone signing up.
 */
const DEFAULT_ROLE = "user";

export async function signupAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const fullName = String(formData.get("fullName") || "").trim();

  // Basic validation
  if (!email || !email.includes("@")) {
    return { error: "Please enter a valid email address." };
  }
  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters long." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  try {
    const supabase = await createServerSupabase();

    // 1. Sign up user with metadata explicitly setting default role as 'user'
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: DEFAULT_ROLE,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (!data.user) {
      return { error: "Could not create user account. Please try again." };
    }

    // Ensure profile row exists in public.profiles with default role 'user'
    try {
      const adminClient = createAdminClient();
      await adminClient.from("profiles").upsert(
        {
          id: data.user.id,
          email: data.user.email || email,
          full_name: fullName,
          role: DEFAULT_ROLE, // Enforce default role 'user'
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id", ignoreDuplicates: false }
      );
    } catch {
      // Trigger handles this automatically; adminClient fallback is a safety measure
    }

    // If email confirmation is required by Supabase:
    if (!data.session) {
      return {
        success: true,
        requiresVerification: true,
        message:
          "Account created successfully! Please check your email to confirm your account before logging in.",
      };
    }

    revalidatePath("/", "layout");
    return {
      success: true,
      requiresVerification: false,
      message: "Account created successfully!",
      user: {
        id: data.user.id,
        email: data.user.email,
        role: DEFAULT_ROLE,
        fullName,
      },
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during signup.",
    };
  }
}

export async function loginAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  try {
    const supabase = await createServerSupabase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        return {
          error:
            "Your email has not been verified yet. Please check your inbox for the confirmation email.",
        };
      }
      return { error: error.message };
    }

    if (!data.user) {
      return { error: "Login failed. Please check your credentials." };
    }

    // Retrieve user's role from database profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", data.user.id)
      .maybeSingle();

    const role = profile?.role || DEFAULT_ROLE;

    revalidatePath("/", "layout");
    return {
      success: true,
      message: "Logged in successfully!",
      user: {
        id: data.user.id,
        email: data.user.email,
        role,
        fullName: profile?.full_name || data.user.user_metadata?.full_name,
      },
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during login.",
    };
  }
}

export async function logoutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function getAuthUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email,
    role: profile?.role || DEFAULT_ROLE,
    fullName: profile?.full_name || user.user_metadata?.full_name || "",
    createdAt: profile?.created_at || user.created_at,
  };
}
