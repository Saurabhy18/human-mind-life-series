import fs from "node:fs/promises";
import { ENV } from "@/config/env.server";
import { verifyAdminApi } from "@/lib/server/auth";
import { getOrder } from "@/lib/server/orders";
import { getStorage } from "@/lib/server/storageService";
import { resolveScreenshotPath, screenshotStorageKey } from "@/lib/server/uploads";

export const runtime = "nodejs";

/** Payment screenshots are only ever served to a logged-in admin. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await verifyAdminApi();
  if (authError) return authError;

  const { id } = await params;
  const order = getOrder(Number(id));
  if (!order) return new Response("Not found", { status: 404 });

  try {
    const key = screenshotStorageKey(order.screenshot_file);
    const data = ENV.storage.driver === "supabase" ? new Uint8Array(await getStorage().get(key)) : new Uint8Array(await fs.readFile(resolveScreenshotPath(order.screenshot_file)));
    return new Response(data, {
      headers: {
        "Content-Type": order.screenshot_mime,
        "Content-Disposition": `inline; filename="${order.ref}-payment.${order.screenshot_file.split(".").pop()}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("File missing", { status: 404 });
  }
}
