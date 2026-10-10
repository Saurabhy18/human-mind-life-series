import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { CONFIG } from "@/config/site.config";
import { getFreeBook } from "@/lib/products";
import { fieldErrors, freeRequestSchema, sanitizeTracking } from "@/lib/validation";
import { createFreeRequest } from "@/lib/server/free-requests";
import { PRIVATE_BOOKS_DIR } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, hashIp, isSameOrigin } from "@/lib/server/request";

export const runtime = "nodejs";

function fail(status: number, message: string, errors?: Record<string, string>) {
  return NextResponse.json({ ok: false, message, errors }, { status });
}

/**
 * Receives "Get Free Book" requests. Only books priced at ₹0 are accepted —
 * there is no payment, QR code, UTR or screenshot anywhere in this flow.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return fail(403, "Invalid request origin.");

  const ip = clientIp(req.headers);
  const limit = rateLimit(`free:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.ok) return fail(429, `Too many requests. Please try again in ${Math.ceil(limit.retryAfterSec / 60)} minutes.`);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid request.");
  }

  // Honeypot: real visitors never see or fill this field.
  if (body.website) return NextResponse.json({ ok: true, ref: "FB-RECEIVED", downloadUrl: null });

  const parsed = freeRequestSchema.safeParse(body);
  if (!parsed.success) return fail(422, "Please correct the highlighted fields.", fieldErrors(parsed.error));
  const data = parsed.data;

  const book = getFreeBook(data.book);
  if (!book) return fail(422, "This book is not available as a free book.");

  // A personal download link is only issued when instant delivery is switched on AND the private PDF exists.
  const pdfExists = fs.existsSync(path.join(PRIVATE_BOOKS_DIR, `${book.slug}.pdf`));
  const instant = CONFIG.FREE_BOOK_INSTANT_DOWNLOAD && pdfExists;

  let tracking: Record<string, string> | null = null;
  try {
    tracking = sanitizeTracking(typeof body.tracking === "string" ? JSON.parse(body.tracking) : body.tracking);
  } catch {
    tracking = null;
  }

  try {
    const { ref, token } = createFreeRequest(
      {
        book_slug: book.slug,
        book_title: book.label,
        author: book.author,
        name: data.name,
        email: data.email,
        whatsapp: data.whatsapp || null,
        utm_json: tracking ? JSON.stringify(tracking) : null,
        ip_hash: hashIp(ip),
        user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
      },
      instant ? CONFIG.FREE_DOWNLOAD_LINK_HOURS : null,
    );
    // Only the public reference (and, if enabled, this reader's own private link) is returned.
    return NextResponse.json({ ok: true, ref, downloadUrl: token ? `/api/free-download/${token}` : null });
  } catch (err) {
    console.error("Free request failed", err);
    return fail(500, "Something went wrong. Please try again or contact us.");
  }
}
