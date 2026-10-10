import fs from "node:fs/promises";
import { isAdmin } from "@/lib/server/auth";
import { getOrder } from "@/lib/server/orders";
import { resolveScreenshotPath } from "@/lib/server/uploads";

export const runtime = "nodejs";

/** Payment screenshots are only ever served to a logged-in admin. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const order = getOrder(Number(id));
  if (!order) return new Response("Not found", { status: 404 });

  try {
    const data = await fs.readFile(resolveScreenshotPath(order.screenshot_file));
    return new Response(new Uint8Array(data), {
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
