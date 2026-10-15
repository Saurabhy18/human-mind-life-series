import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const getEnv = (name: string): string => {
  const value = process.env[name];
  return value === undefined || value === "" ? "" : value.trim();
};

export const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("SUPABASE_URL");
export const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || getEnv("SUPABASE_ANON_KEY");
export const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function createSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createSupabaseAdminClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function verifySupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  if (!supabaseUrl) {
    return { ok: false, message: "Supabase URL is missing." };
  }

  if (!supabaseAnonKey) {
    return { ok: false, message: "Supabase anon key is missing." };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `Supabase health check failed: HTTP ${response.status}`,
      };
    }

    return { ok: true, message: "Supabase credentials are working." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown Supabase check error.",
    };
  }
}
