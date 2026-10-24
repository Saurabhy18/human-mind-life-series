"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import {
  createDbBook,
  updateDbBook,
  deleteDbBook,
  toggleBookStatus,
  uploadBookPdfToStorage,
  getDbBookById,
  getDbBookBySlug,
} from "@/lib/server/books";

export type ActionState = {
  ok?: boolean;
  error?: string;
  success?: string;
};

export async function createBookAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const title = (formData.get("title") as string)?.trim();
  const author = (formData.get("author") as string)?.trim();
  let slug = (formData.get("slug") as string)?.trim().toLowerCase();
  const volumeStr = (formData.get("volume") as string)?.trim();
  const tagline = (formData.get("tagline") as string)?.trim();
  const shortDescription = (formData.get("short_description") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const priceStr = (formData.get("price") as string)?.trim();
  const originalPriceStr = (formData.get("original_price") as string)?.trim();
  const isFree = formData.get("is_free") === "on" || formData.get("is_free") === "true";
  const forSale = formData.get("for_sale") === "on" || formData.get("for_sale") === "true";
  const hideVolumeLabel = formData.get("hide_volume_label") === "on";
  const adultsOnly = formData.get("adults_only") === "on";
  const coverBg = (formData.get("cover_bg") as string)?.trim() || "#13233f";
  const coverAccent = (formData.get("cover_accent") as string)?.trim() || "#c9a24f";
  const disclaimer = (formData.get("disclaimer") as string)?.trim();

  // Bullet points and topics (line-separated)
  const learnLines = ((formData.get("learn") as string) || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const topicLines = ((formData.get("topics") as string) || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!title) return { ok: false, error: "Book title is required." };
  if (!author) return { ok: false, error: "Author name is required." };

  if (!slug) {
    slug = title
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // Check slug collision
  const existing = getDbBookBySlug(slug);
  if (existing) {
    return { ok: false, error: `A book with the slug '${slug}' already exists. Please choose a different slug.` };
  }

  // Handle PDF file upload
  const pdfFile = formData.get("pdf_file") as File | null;
  if (!pdfFile || pdfFile.size === 0) {
    return { ok: false, error: "A book manuscript PDF file is required." };
  }

  if (!pdfFile.name.toLowerCase().endsWith(".pdf") && pdfFile.type !== "application/pdf") {
    return { ok: false, error: "Uploaded file must be a valid PDF document." };
  }

  const pdfFilename = `${slug}.pdf`;
  const pdfArrayBuffer = await pdfFile.arrayBuffer();
  const pdfBuffer = Buffer.from(pdfArrayBuffer);

  const uploadResult = await uploadBookPdfToStorage(pdfFilename, pdfBuffer);
  if (!uploadResult.ok) {
    return { ok: false, error: `Failed to upload PDF to Supabase Storage: ${uploadResult.error}` };
  }

  const volume = volumeStr ? parseInt(volumeStr, 10) : null;
  const price = isFree ? 0 : priceStr ? parseFloat(priceStr) : 299;
  const originalPrice = originalPriceStr ? parseFloat(originalPriceStr) : null;

  try {
    createDbBook({
      slug,
      title,
      author,
      volume: isNaN(volume as number) ? null : volume,
      tagline: tagline || null,
      short_description: shortDescription || null,
      description: description || null,
      price,
      original_price: originalPrice,
      currency: "INR",
      is_free: isFree,
      for_sale: forSale,
      pdf_filename: pdfFilename,
      learn: learnLines,
      topics: topicLines,
      hide_volume_label: hideVolumeLabel,
      adults_only: adultsOnly,
      cover_bg: coverBg,
      cover_accent: coverAccent,
      disclaimer: disclaimer || null,
    });
  } catch (err: unknown) {
    console.error("Failed to create book:", err);
    return { ok: false, error: (err instanceof Error ? err.message : String(err)) || "Failed to save book to database." };
  }

  revalidatePath("/admin/books");
  revalidatePath("/books");
  redirect("/admin/books");
}

export async function updateBookAction(
  id: number,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const existing = getDbBookById(id);
  if (!existing) return { ok: false, error: "Book not found." };

  const title = (formData.get("title") as string)?.trim();
  const author = (formData.get("author") as string)?.trim();
  let slug = (formData.get("slug") as string)?.trim().toLowerCase();
  const volumeStr = (formData.get("volume") as string)?.trim();
  const tagline = (formData.get("tagline") as string)?.trim();
  const shortDescription = (formData.get("short_description") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const priceStr = (formData.get("price") as string)?.trim();
  const originalPriceStr = (formData.get("original_price") as string)?.trim();
  const isFree = formData.get("is_free") === "on" || formData.get("is_free") === "true";
  const forSale = formData.get("for_sale") === "on" || formData.get("for_sale") === "true";
  const hideVolumeLabel = formData.get("hide_volume_label") === "on";
  const adultsOnly = formData.get("adults_only") === "on";
  const coverBg = (formData.get("cover_bg") as string)?.trim() || "#13233f";
  const coverAccent = (formData.get("cover_accent") as string)?.trim() || "#c9a24f";
  const disclaimer = (formData.get("disclaimer") as string)?.trim();

  const learnLines = ((formData.get("learn") as string) || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const topicLines = ((formData.get("topics") as string) || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!title) return { ok: false, error: "Book title is required." };
  if (!author) return { ok: false, error: "Author name is required." };

  if (!slug) {
    slug = existing.slug;
  }

  // Handle optional PDF replacement upload
  const pdfFile = formData.get("pdf_file") as File | null;
  let pdfFilename = existing.pdf_filename;

  if (pdfFile && pdfFile.size > 0) {
    if (!pdfFile.name.toLowerCase().endsWith(".pdf") && pdfFile.type !== "application/pdf") {
      return { ok: false, error: "Uploaded replacement file must be a valid PDF document." };
    }
    pdfFilename = `${slug}.pdf`;
    const pdfArrayBuffer = await pdfFile.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    const uploadResult = await uploadBookPdfToStorage(pdfFilename, pdfBuffer);
    if (!uploadResult.ok) {
      return { ok: false, error: `Failed to upload replacement PDF: ${uploadResult.error}` };
    }
  }

  const volume = volumeStr ? parseInt(volumeStr, 10) : null;
  const price = isFree ? 0 : priceStr ? parseFloat(priceStr) : existing.price;
  const originalPrice = originalPriceStr ? parseFloat(originalPriceStr) : null;

  try {
    updateDbBook(id, {
      slug,
      title,
      author,
      volume: isNaN(volume as number) ? null : volume,
      tagline: tagline || null,
      short_description: shortDescription || null,
      description: description || null,
      price,
      original_price: originalPrice,
      is_free: isFree,
      for_sale: forSale,
      pdf_filename: pdfFilename,
      learn: learnLines,
      topics: topicLines,
      hide_volume_label: hideVolumeLabel,
      adults_only: adultsOnly,
      cover_bg: coverBg,
      cover_accent: coverAccent,
      disclaimer: disclaimer || null,
    });
  } catch (err: unknown) {
    console.error("Failed to update book:", err);
    return { ok: false, error: (err instanceof Error ? err.message : String(err)) || "Failed to update book in database." };
  }

  revalidatePath("/admin/books");
  revalidatePath(`/admin/books/${id}`);
  revalidatePath("/books");
  return { ok: true, success: "Book updated successfully!" };
}

export async function deleteBookAction(formData: FormData) {
  await requireAdmin();

  const idStr = formData.get("id") as string;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) throw new Error("Invalid book ID.");

  const deletePdf = formData.get("delete_pdf") === "true";
  await deleteDbBook(id, deletePdf);

  revalidatePath("/admin/books");
  revalidatePath("/books");
  redirect("/admin/books");
}

export async function toggleBookStatusAction(formData: FormData) {
  await requireAdmin();

  const idStr = formData.get("id") as string;
  const id = parseInt(idStr, 10);
  const field = formData.get("field") as "is_free" | "for_sale";
  const value = formData.get("value") === "true";

  if (isNaN(id) || !field) throw new Error("Invalid parameters.");

  toggleBookStatus(id, field, value);

  revalidatePath("/admin/books");
  revalidatePath("/books");
}
