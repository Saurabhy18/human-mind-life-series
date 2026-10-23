import "server-only";
import { cache } from "react";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/server/db";

const COOKIE_NAME = "hm_admin";
const SESSION_HOURS = 8;

function secretKey(): Uint8Array | null {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) return null;
  return new TextEncoder().encode(s);
}

/** Admin login is only possible once both secrets are set in .env.local. */
export function adminConfigured(): boolean {
  return !!secretKey() && !!process.env.ADMIN_PASSWORD_HASH;
}

/**
 * Verifies a password against ADMIN_PASSWORD_HASH, created with
 * `npm run hash-password`. Format: scrypt:<salt hex>:<hash hex>
 */
export function verifyPassword(password: string): boolean {
  const stored = process.env.ADMIN_PASSWORD_HASH || "";
  const [algo, saltHex, hashHex] = stored.split(":");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length > 0 && crypto.timingSafeEqual(actual, expected);
}

export async function createSession(): Promise<void> {
  const key = secretKey();
  if (!key) throw new Error("SESSION_SECRET is not configured");
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

export const isLegacyAdmin = cache(async (): Promise<boolean> => {
  const key = secretKey();
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (key && token) {
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
      if (payload.role === "admin") return true;
    } catch {
      // not a legacy admin session, check Supabase auth below
    }
  }
  return false;
});

/** Returns the authenticated user's role ("admin" | "user") or null if not logged in. */
export const getCurrentUserRole = cache(async (): Promise<string | null> => {
  if (await isLegacyAdmin()) {
    return "admin";
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // 1. Try Supabase profiles table
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role) {
          return profile.role;
        }
      } catch {}

      // 2. Fallback to server DB profiles table
      try {
        const local = getDb()
          .prepare("SELECT role FROM profiles WHERE id = ?")
          .get(user.id) as { role?: string } | undefined;
        if (local?.role) {
          return local.role;
        }
      } catch {}

      // 3. Fallback to app_metadata (service role only) or default to 'user'
      if (typeof user.app_metadata?.role === "string") {
        return user.app_metadata.role;
      }
      return "user";
    }
  } catch {}

  return null;
});

export const isAdmin = cache(async (): Promise<boolean> => {
  const role = await getCurrentUserRole();
  return role === "admin";
});

/** Returns the currently authenticated Supabase user or null if not logged in. */
export const getAuthenticatedUser = cache(async () => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
});

/**
 * Call at the top of every admin page and server action.
 * Ensures protected admin routes are NOT accessible to users with a different role.
 */
export const requireAdmin = cache(async (): Promise<void> => {
  const isAdm = await isAdmin();
  if (isAdm) return;

  const user = await getAuthenticatedUser();
  if (user) {
    // Authenticated user has a different role ('user') -> cannot access admin routes!
    redirect("/orders");
  }

  // Unauthenticated visitor -> redirect to admin login
  redirect("/admin/login");
});

/**
 * Role check for Admin backend API routes.
 * Returns null if authorized as admin.
 * Returns 403 Forbidden if user is authenticated with a different role.
 * Returns 401 Unauthorized if not authenticated.
 */
export async function verifyAdminApi(): Promise<NextResponse | null> {
  const isAdm = await isAdmin();
  if (isAdm) return null;

  const user = await getAuthenticatedUser();
  if (user) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Access restricted to administrators" },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { success: false, error: "Unauthorized: Authentication required" },
    { status: 401 }
  );
}
