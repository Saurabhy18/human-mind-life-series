import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { createClient } from "@/lib/supabase/server";


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


export async function isAdmin(): Promise<boolean> {
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

  // Check Supabase authenticated session
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "admin") {
        return true;
      }
    }
  } catch {}

  return false;
}


/** Call at the top of every admin page, server action and admin API route. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
