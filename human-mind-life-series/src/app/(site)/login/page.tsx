import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Human Mind & Life Series account.",
};

export default async function LoginPage(props: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const next = searchParams?.next || "/";

  // If already authenticated, redirect to next
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (!searchParams?.next) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role === "admin") redirect("/admin");
    }
    redirect(next);
  }

  return (
    <div className="py-16 sm:py-24">
      <div className="container-page">
        <Suspense
          fallback={
            <div className="card max-w-md mx-auto p-12 text-center text-muted">
              Loading sign in form...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
