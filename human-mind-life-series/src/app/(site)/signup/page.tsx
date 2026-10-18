import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/SignupForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create an account to access the Human Mind & Life Series bookstore.",
};

export default async function SignupPage(props: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const next = searchParams?.next || "/dashboard";

  // If already authenticated, redirect to next
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(next);
  }

  return (
    <div className="py-16 sm:py-24">
      <div className="container-page">
        <Suspense
          fallback={
            <div className="card max-w-md mx-auto p-12 text-center text-muted">
              Loading signup form...
            </div>
          }
        >
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
