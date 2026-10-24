import fs from "node:fs/promises";
import path from "node:path";
import { verifyAdminApi } from "@/lib/server/auth";
import { PRIVATE_BOOKS_DIR } from "@/lib/server/db";
import { FREE_BOOKS, getAllProducts } from "@/lib/products";
import { ensureBookSource, getBookSource } from "@/lib/server/translation/bookSource";
import { getDbBookBySlug } from "@/lib/server/books";

export const runtime = "nodejs";

/**
 * Lets the admin download a book PDF (from storage/books/<slug>.pdf) to attach
 * to an email or WhatsApp message. Never publicly accessible.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authError = await verifyAdminApi();
  if (authError) return authError;

  const { slug } = await params;
  // Slugs from static catalogue or database are accepted
  const isExisting = [...getAllProducts(), ...FREE_BOOKS].some((p) => p.slug === slug) || !!getDbBookBySlug(slug);
  if (!isExisting) return new Response("Not found", { status: 404 });

  try {
    await ensureBookSource(slug);
    const source = getBookSource(slug);
    const targetPath = source ? source.filePath : path.join(/*turbopackIgnore: true*/ PRIVATE_BOOKS_DIR, `${slug}.pdf`);
    const data = await fs.readFile(targetPath);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response(`PDF not found. Upload it to storage/books/${slug}.pdf on the server or the storage bucket.`, { status: 404 });
  }
}
