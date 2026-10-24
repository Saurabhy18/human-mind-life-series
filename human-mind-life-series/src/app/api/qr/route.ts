import fs from "node:fs";
import path from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { ENV } from "@/config/env.server";

export const runtime = "nodejs";

let cachedQrBuffer: { data: Buffer; at: number; contentType: string } | null = null;
let lastKnownQrLocation: { bucket: string; file: string } | null = null;
let notFoundUntil = 0;
const CACHE_TTL_MS = 300_000; // 5 minutes in-memory cache

export async function GET() {
  const now = Date.now();

  // 1. Check in-memory cache
  if (cachedQrBuffer && now - cachedQrBuffer.at < CACHE_TTL_MS) {
    return new Response(new Uint8Array(cachedQrBuffer.data), {
      status: 200,
      headers: {
        "Content-Type": cachedQrBuffer.contentType,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      },
    });
  }

  // If known to be missing recently, avoid repeated storage network attempts
  if (now < notFoundUntil) {
    return new Response("QR code not found", {
      status: 404,
      headers: { "Cache-Control": "public, max-age=30" },
    });
  }

  // 2. Local check FIRST (instant local disk read: <0.1ms)
  for (const localFile of ["upi-qr.png", "qrcode.png"]) {
    try {
      const localPath = path.join(process.cwd(), "public", "images", localFile);
      if (fs.existsSync(localPath)) {
        const buffer = fs.readFileSync(localPath);
        if (buffer.length > 0) {
          const contentType = localFile.endsWith(".jpg") || localFile.endsWith(".jpeg") ? "image/jpeg" : "image/png";
          cachedQrBuffer = { data: buffer, at: now, contentType };

          return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
            },
          });
        }
      }
    } catch {}
  }

  // 3. Fallback to Supabase Storage only if local file is absent
  try {
    const supabase = createSupabaseAdminClient();
    if (supabase) {
      const candidates = lastKnownQrLocation
        ? [lastKnownQrLocation]
        : [
            { bucket: ENV.storage.bucket || "site-files", file: "qrcode.png" },
            { bucket: ENV.storage.bucket || "site-files", file: "qrcode.jpg" },
            { bucket: ENV.storage.bucket || "site-files", file: "upi-qr.png" },
            { bucket: "qrcode", file: "qrcode.png" },
            { bucket: "qrcode", file: "qrcode.jpg" },
          ];

      for (const { bucket, file } of candidates) {
        try {
          const { data, error } = await supabase.storage.from(bucket).download(file);
          if (!error && data) {
            const arrayBuffer = await data.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = data.type || (file.endsWith(".jpg") || file.endsWith(".jpeg") ? "image/jpeg" : "image/png");

            cachedQrBuffer = { data: buffer, at: now, contentType };
            lastKnownQrLocation = { bucket, file };

            // Save copy locally for fast subsequent reads
            try {
              const localPath = path.join(process.cwd(), "public", "images", "upi-qr.png");
              fs.mkdirSync(path.dirname(localPath), { recursive: true });
              fs.writeFileSync(localPath, buffer);
            } catch {}

            return new Response(new Uint8Array(buffer), {
              status: 200,
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
              },
            });
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn("[/api/qr] Supabase storage lookup failed:", err);
  }

  // Mark not found for 30s to prevent spamming
  notFoundUntil = now + 30_000;
  return new Response("QR code not found", {
    status: 404,
    headers: { "Cache-Control": "public, max-age=30" },
  });
}
