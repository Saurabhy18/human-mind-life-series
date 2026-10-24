"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthContext";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const { refresh: refreshAuth } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth-callback-failed"
      ? "Authentication link expired or invalid. Please sign in with your password."
      : null
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.error && data.error.toLowerCase().includes("email not confirmed")) {
          setError("Your email has not been verified yet. Please check your inbox for the confirmation email.");
        } else {
          setError(data.error || "Invalid email or password.");
        }
        setLoading(false);
        return;
      }

      if (data.session) {
        try {
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.setSession(data.session);
        } catch {
          // Cookies already configured
        }
      }

      // Pull the signed-in user into the auth context before navigating.
      // setSession() above normally emits SIGNED_IN, which AuthProvider listens
      // for, but it reports some failures by returning an error instead of
      // throwing, and then no event is emitted at all. Relying on it left the
      // header showing a signed-out state until the next full page load, so
      // refresh explicitly: the login response already proves we are signed in.
      await refreshAuth();

      // Admins land on the admin dashboard unless a specific page asked them to come back.
      const explicitNext = searchParams.get("next");
      // Re-render server components with the new session cookie first, so the
      // destination is not served from the logged-out entry in the router cache.
      router.refresh();
      router.push(!explicitNext && data.user?.role === "admin" ? "/admin" : next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="card p-8 sm:p-10 shadow-lg border-line/80 bg-white">
        <div className="text-center mb-8">
          <p className="eyebrow mb-2">Welcome Back</p>
          <h1 className="font-serif text-3xl font-medium text-ink">Sign In</h1>
          <p className="mt-2 text-sm text-muted">
            Access your account, purchased ebooks, and reading materials.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger flex items-start gap-3"
          >
            <span className="font-bold">Error:</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="label">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="label mb-0">
                Password
              </label>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 text-base font-medium mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Signing in...</span>
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-line pt-6 text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-gold-dark hover:underline"
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
