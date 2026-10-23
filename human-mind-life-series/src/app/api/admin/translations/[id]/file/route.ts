import { verifyAdminApi } from "@/lib/server/auth";
import { getTranslatedBook } from "@/lib/server/adminReports";
import { getStorage } from "@/lib/server/storageService";

export const runtime = "nodejs";

/** Admin-only download of a translated book (e.g. to check quality or send it manually). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await verifyAdminApi();
  if (authError) return authError;

  const tb = getTranslatedBook(Number((await params).id));
  if (!tb) return new Response("Not found", { status: 404 });
  try {
    const data = await getStorage().get(tb.storage_key);
    return new Response(Buffer.from(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${tb.book_slug}-${tb.target_language}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("File missing from storage", { status: 404 });
  }
}
