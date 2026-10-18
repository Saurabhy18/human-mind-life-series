import { ENV } from "@/config/env.server";
import { isSupabaseConfigured, supabaseServiceRoleKey, supabaseUrl } from "@/lib/supabase";

export type DatabaseDriver = "sqlite" | "supabase";

export function resolveDatabaseDriver(): DatabaseDriver {
  if (ENV.database.driver === "supabase") return "supabase";
  return "sqlite";
}

export function isSupabaseMigrationReady(): boolean {
  return ENV.database.driver === "supabase" && !!supabaseUrl && !!supabaseServiceRoleKey && isSupabaseConfigured();
}

export function getDatabaseMigrationStatus(): {
  driver: DatabaseDriver;
  ready: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (ENV.database.driver === "supabase") {
    if (!supabaseUrl) issues.push("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseServiceRoleKey) issues.push("Missing SUPABASE_SERVICE_ROLE_KEY");
    if (!isSupabaseConfigured()) issues.push("Missing Supabase anon or publishable key");
  }

  return {
    driver: resolveDatabaseDriver(),
    ready: issues.length === 0,
    issues,
  };
}
