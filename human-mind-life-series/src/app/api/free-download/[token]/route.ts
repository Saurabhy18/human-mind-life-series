import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { CONFIG } from "@/config/site.config";
import { ENV } from "@/config/env.server";
import { getDbFreeBook } from "@/lib/server/books";
import { PRIVATE_BOOKS_DIR } from "@/lib/server/db";
import { consumeDownloadToken, refundDownload } from "@/lib/server/free-requests";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import { getStorage } from "@/lib/server/storageService";
import { ensureBookSource, getBookSource } from "@/lib/server/translation/bookSource";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

function message(status: number, text: string) {
  return new Response(text, { status, headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
}

/**
 * Personal download link for a FREE book, issued only after the "Get Free
 * Book" form. The PDF itself lives in private storage; this link expires and
 * can only be used a limited number of times.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limit = rateLimit(`free-dl:${clientIp(req.headers)}`, 20, 15 * 60 * 1000);
  if (!limit.ok) return message(429, "Too many requests. Please try again later.");

  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return message(404, "This download link is not valid.");

  const request = consumeDownloadToken(token, CONFIG.FREE_DOWNLOAD_LIMIT);
  if (!request) {
    return message(410, "This download link has expired or has already been used the maximum number of times. Please request your free copy again from the book page.");
  }

  // Only slugs of free books from the catalogue or DB are accepted, which also prevents path tricks.
  const book = getDbFreeBook(request.book_slug);
  if (!book) {
    refundDownload(request.id);
    return message(404, "This book is no longer available.");
  }

  try {
    const fileName = `${book.label.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
    const storageKey = book.pdfFilename || `${book.slug}.pdf`;

    if (ENV.storage.driver === "supabase") {
      try {
        const url = await getStorage().signedUrl(storageKey, {
          ttlSeconds: CONFIG.FREE_DOWNLOAD_LINK_HOURS * 3600,
          downloadName: fileName,
        });
        return NextResponse.redirect(url, 302);
      } catch (e) {
        console.warn("[free-download] Supabase signedUrl failed, falling back to local file:", e);
      }
    }

    await ensureBookSource(book.slug);
    const source = getBookSource(book.slug);
    const targetPath = source ? source.filePath : path.join(/*turbopackIgnore: true*/ PRIVATE_BOOKS_DIR, storageKey);
    const data = await fs.readFile(targetPath);
    return new Response(new Uint8Array(data), {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch {
    refundDownload(request.id);
    return message(503, "The book file is temporarily unavailable. We have your request and will send your copy by email.");
  }
}
