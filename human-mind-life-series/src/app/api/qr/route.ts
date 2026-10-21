import fs from "node:fs";
import path from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { ENV } from "@/config/env.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cachedQrBuffer: { data: Buffer; at: number; contentType: string } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute in-memory cache

export async function GET() {
  // Check memory cache first
  if (cachedQrBuffer && Date.now() - cachedQrBuffer.at < CACHE_TTL_MS) {
    return new Response(new Uint8Array(cachedQrBuffer.data), {
      status: 200,
      headers: {
        "Content-Type": cachedQrBuffer.contentType,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=3600",
      },
    });
  }

  // 1. Try Supabase Storage
  try {
    const supabase = createSupabaseAdminClient();
    if (supabase) {
      const candidates = [
        { bucket: ENV.storage.bucket || "site-files", file: "qrcode.png" },
        { bucket: ENV.storage.bucket || "site-files", file: "qrcode.jpg" },
        { bucket: ENV.storage.bucket || "site-files", file: "qrcode.jpeg" },
        { bucket: ENV.storage.bucket || "site-files", file: "qrcode" },
        { bucket: "qrcode", file: "qrcode.png" },
        { bucket: "qrcode", file: "qrcode.jpg" },
        { bucket: "qrcode", file: "qrcode.jpeg" },
        { bucket: "qrcode", file: "qrcode" },
      ];

      for (const { bucket, file } of candidates) {
        try {
          const { data, error } = await supabase.storage.from(bucket).download(file);
          if (!error && data) {
            const arrayBuffer = await data.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = data.type || (file.endsWith(".jpg") || file.endsWith(".jpeg") ? "image/jpeg" : "image/png");

            cachedQrBuffer = { data: buffer, at: Date.now(), contentType };

            // Save copy locally for offline reliability
            try {
              const localPath = path.join(process.cwd(), "public", "images", "upi-qr.png");
              fs.mkdirSync(path.dirname(localPath), { recursive: true });
              fs.writeFileSync(localPath, buffer);
            } catch {}

            return new Response(new Uint8Array(buffer), {
              status: 200,
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=60, stale-while-revalidate=3600",
              },
            });
          }
        } catch {
          // continue to next candidate
        }
      }
    }
  } catch (err) {
    console.warn("[/api/qr] Supabase storage lookup failed, falling back to local file:", err);
  }

  // 2. Local fallback from public/images/upi-qr.png or public/images/qrcode.png
  for (const localFile of ["upi-qr.png", "qrcode.png"]) {
    try {
      const localPath = path.join(process.cwd(), "public", "images", localFile);
      if (fs.existsSync(localPath)) {
        const buffer = fs.readFileSync(localPath);
        const contentType = localFile.endsWith(".jpg") ? "image/jpeg" : "image/png";
        cachedQrBuffer = { data: buffer, at: Date.now(), contentType };

        return new Response(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=60, stale-while-revalidate=3600",
          },
        });
      }
    } catch {}
  }

  return new Response("QR code not found", { status: 404 });
}
