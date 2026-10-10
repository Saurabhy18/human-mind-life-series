import { redirect } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/server/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  const configured = adminConfigured();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <p className="eyebrow">Admin</p>
        <h1 className="mt-2 text-2xl">Order management</h1>
        {configured ? (
          <div className="mt-6">
            <LoginForm />
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm leading-relaxed text-ink/80">
            <p className="font-semibold text-danger">Admin login is not set up yet.</p>
            <p className="mt-2">
              Run <code className="rounded bg-white px-1">npm run setup-admin</code> on the server, then restart. See README.md → “Admin setup”.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
