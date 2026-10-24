"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AuthUser = {
  id: string;
  email?: string;
  role: string;
  fullName?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/user");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            role: data.user.role || "user",
            fullName: data.user.fullName || "",
          });
          return;
        }
      }
      setUser(null);
    } catch {
      // Keep existing state or clear if request fails
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function initAuth() {
      try {
        const res = await fetch("/api/auth/user");
        if (ignore) return;
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser({
              id: data.user.id,
              email: data.user.email,
              role: data.user.role || "user",
              fullName: data.user.fullName || "",
            });
            return;
          }
        }
        setUser(null);
      } catch {
        // Fallback
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    initAuth();

    const supabase = createSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (ignore) return;
      // Skip initial event since initAuth() already ran above
      if (event === "INITIAL_SESSION") return;
      await initAuth();
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    // Each step is best-effort: a failure in one must not leave the user stuck signed in.
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } catch {
      // Ignore
    }
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore
    }
    setUser(null);
    router.push("/login");
    router.refresh();
  }, [router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchProfile();
  }, [fetchProfile]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      role: user?.role || null,
      loading,
      signOut,
      refresh,
    }),
    [user, loading, signOut, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
