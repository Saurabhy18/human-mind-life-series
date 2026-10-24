import { requireAdmin } from "@/lib/server/auth";
import { countUnhandledMessages } from "@/lib/server/orders";
import { countFreeByStatus } from "@/lib/server/free-requests";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  let unread = 0;
  let newFree = 0;
  try {
    unread = countUnhandledMessages();
    newFree = countFreeByStatus().received;
  } catch (err: unknown) {
    console.error("ProtectedAdminLayout counts error:", err);
  }

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col md:flex-row">
      <AdminSidebar unreadMessages={unread} newFreeRequests={newFree} />
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
