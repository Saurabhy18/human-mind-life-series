import fs from "node:fs/promises";
import path from "node:path";
import { isAdmin } from "@/lib/server/auth";
import { PRIVATE_BOOKS_DIR } from "@/lib/server/db";
import { FREE_BOOKS, getAllProducts } from "@/lib/products";

export const runtime = "nodejs";

/**
 * Lets the admin download a book PDF (from storage/books/<slug>.pdf) to attach
 * to an email or WhatsApp message. Never publicly accessible.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });

  const { slug } = await params;
  // Only slugs from the catalogue are accepted, which also prevents path tricks.
  if (![...getAllProducts(), ...FREE_BOOKS].some((p) => p.slug === slug)) return new Response("Not found", { status: 404 });

  try {
    const data = await fs.readFile(path.join(PRIVATE_BOOKS_DIR, `${slug}.pdf`));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response(`PDF not found. Upload it to storage/books/${slug}.pdf on the server.`, { status: 404 });
  }
}
