"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
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
  const isFetchingRef = useRef(false);
  const router = useRouter();

  const fetchProfile = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
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
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Check existing session on client
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Pre-populate basic info from session, verified role is loaded by fetchProfile()
        setUser({
          id: session.user.id,
          email: session.user.email,
          role: "user",
          fullName: session.user.user_metadata?.full_name || "",
        });
        fetchProfile();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setLoading(false);
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        setUser({
          id: session.user.id,
          email: session.user.email,
          role: "user",
          fullName: session.user.user_metadata?.full_name || "",
        });
        await fetchProfile();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
      router.refresh();
    } catch {
      // Ignore
    }
  }, [router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchProfile();
  }, [fetchProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        loading,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
