"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

export function AdminLogoutButton() {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut();
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-danger/25 bg-danger/10 px-3 py-1.5 font-medium text-danger transition hover:border-danger hover:bg-danger hover:text-white disabled:cursor-wait disabled:opacity-60"
    >
      <LogOut size={14} />
      {pending ? "Logging out..." : "Log out"}
    </button>
  );
}
