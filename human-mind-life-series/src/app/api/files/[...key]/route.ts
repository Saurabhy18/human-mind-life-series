import { getStorage, verifyLocalSignature } from "@/lib/server/storageService";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import { ENV } from "@/config/env.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

/**
 * Serves a privately stored file ONLY with a valid, unexpired signature
 * (issued by /api/orders/:id/download). Used by the local storage driver;
 * with Google Cloud Storage the signed URL points at the private bucket instead.
 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (ENV.storage.driver !== "local") return new Response("Not found", { status: 404 });
  if (!rateLimit(`files:${clientIp(req.headers)}`, 30, 15 * 60_000).ok) return new Response("Too many requests", { status: 429, headers: PRIVATE });

  const key = (await params).key.join("/");
  let check;
  try {
    check = verifyLocalSignature(new URL(req.url).searchParams, key);
  } catch {
    return new Response("Not found", { status: 404, headers: PRIVATE });
  }
  if (!check.ok) {
    return new Response(check.reason === "expired" ? "This download link has expired. Please request a new one from your order page." : "Invalid download link.", {
      status: check.reason === "expired" ? 410 : 403,
      headers: { ...PRIVATE, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  try {
    const data = await getStorage().get(key);
    const name = check.name.replace(/[^A-Za-z0-9._-]/g, "_");
    return new Response(Buffer.from(data), {
      headers: { ...PRIVATE, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Content-Length": String(data.length) },
    });
  } catch {
    return new Response("Not found", { status: 404, headers: PRIVATE });
  }
}
