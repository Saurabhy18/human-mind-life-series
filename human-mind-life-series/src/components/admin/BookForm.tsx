"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { DbBook } from "@/lib/server/books";
import type { ActionState } from "@/app/admin/books/actions";

interface BookFormProps {
  initialData?: DbBook;
  isEdit?: boolean;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}

export function BookForm({ initialData, isEdit = false, action }: BookFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [forSale, setForSale] = useState(initialData ? initialData.for_sale : true);
  const [isFree, setIsFree] = useState(initialData ? initialData.is_free : false);
  const [title, setTitle] = useState(initialData ? initialData.title : "");
  const [slug, setSlug] = useState(initialData ? initialData.slug : "");
  const [coverBg, setCoverBg] = useState(initialData ? initialData.cover_bg : "#13233f");
  const [coverAccent, setCoverAccent] = useState(initialData ? initialData.cover_accent : "#c9a24f");

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isEdit && (!slug || slug === title.toLowerCase().replace(/[^a-z0-9_-]/g, "-"))) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  };

  return (
    <form action={formAction} className="space-y-8 max-w-4xl">
      {/* Alert message */}
      {state.error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm font-medium text-danger">
          <strong>Error:</strong> {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm font-medium text-success">
          {state.success}
        </div>
      )}

      {/* 1. Basic Metadata */}
      <div className="card p-6 sm:p-8 space-y-6">
        <h2 className="font-serif text-xl font-medium text-ink border-b border-line pb-3">
          1. Book Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Title */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Book Title <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              name="title"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. The Psychology of Human Behavior"
              className="input w-full"
            />
          </div>

          {/* Author */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Author / Pen Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              name="author"
              required
              defaultValue={initialData?.author || ""}
              placeholder="e.g. Adrian Cole"
              className="input w-full"
            />
          </div>

          {/* Volume */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Volume Number (Optional)
            </label>
            <input
              type="number"
              name="volume"
              min="1"
              max="99"
              defaultValue={initialData?.volume != null ? initialData.volume : ""}
              placeholder="e.g. 1"
              className="input w-full"
            />
          </div>

          {/* Slug */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              URL Slug <span className="text-danger">*</span>
            </label>
            <div className="flex items-center">
              <span className="rounded-l-lg border border-r-0 border-line bg-paper px-3 py-2 text-xs font-mono text-muted">
                /books/
              </span>
              <input
                type="text"
                name="slug"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"))}
                placeholder="the-psychology-of-human-behavior"
                className="input rounded-l-none font-mono text-sm w-full"
              />
            </div>
            <p className="mt-1 text-xs text-muted">
              Used in the website address. Letters, numbers and hyphens only.
            </p>
          </div>

          {/* Tagline */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Subtitle / Tagline
            </label>
            <input
              type="text"
              name="tagline"
              defaultValue={initialData?.tagline || ""}
              placeholder="e.g. Understand the forces that shape how people think, feel and act."
              className="input w-full"
            />
          </div>

          {/* Short Description */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Short Description (Summary)
            </label>
            <textarea
              name="short_description"
              rows={2}
              defaultValue={initialData?.short_description || ""}
              placeholder="Brief summary used in cards and social share previews..."
              className="input w-full resize-y"
            />
          </div>

          {/* Full Description */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Full Description
            </label>
            <textarea
              name="description"
              rows={5}
              defaultValue={initialData?.description || ""}
              placeholder="Detailed description of the book..."
              className="input w-full resize-y"
            />
          </div>
        </div>
      </div>

      {/* 2. PDF Manuscript Upload */}
      <div className="card p-6 sm:p-8 space-y-4">
        <h2 className="font-serif text-xl font-medium text-ink border-b border-line pb-3">
          2. Book PDF File (Supabase Storage)
        </h2>
        <p className="text-sm text-muted">
          Upload the book&apos;s source PDF manuscript. It will be stored securely in the Supabase Storage bucket
          (<code>site-files</code>) and served for customer downloads.
        </p>

        {isEdit && initialData?.pdf_filename && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-paper border border-line">
            <span className="text-xs font-semibold uppercase text-gold-dark">Current PDF:</span>
            <span className="font-mono text-xs text-ink">{initialData.pdf_filename}</span>
            <a
              href={`/api/admin/books/${initialData.slug}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-xs font-medium text-gold-dark hover:underline"
            >
              Preview Current PDF ↗
            </a>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
            {isEdit ? "Upload Replacement PDF (Optional)" : "Select Book PDF *"}
          </label>
          <input
            type="file"
            name="pdf_file"
            accept=".pdf,application/pdf"
            required={!isEdit}
            className="input w-full file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-ink file:text-white hover:file:bg-gold-dark transition"
          />
          <p className="mt-1.5 text-xs text-muted">
            Format: Standard PDF document. Maximum file size: 50MB.
          </p>
        </div>
      </div>

      {/* 3. Pricing & Distribution Channels */}
      <div className="card p-6 sm:p-8 space-y-6">
        <h2 className="font-serif text-xl font-medium text-ink border-b border-line pb-3">
          3. Distribution &amp; Pricing
        </h2>

        <div className="space-y-4">
          {/* Sale Option */}
          <div className="p-4 rounded-xl border border-line bg-paper/40">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="for_sale"
                checked={forSale}
                onChange={(e) => setForSale(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-line text-gold focus:ring-gold"
              />
              <div>
                <span className="text-sm font-semibold text-ink">Available for Sale</span>
                <p className="text-xs text-muted">
                  Enables checkout and allows readers to buy this book with UPI / Cards.
                </p>
              </div>
            </label>

            {forSale && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Selling Price (INR ₹) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    name="price"
                    min="1"
                    step="1"
                    defaultValue={initialData?.price ?? 299}
                    required={forSale}
                    placeholder="299"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Original / Strikethrough Price (INR ₹)
                  </label>
                  <input
                    type="number"
                    name="original_price"
                    min="1"
                    step="1"
                    defaultValue={initialData?.original_price ?? 599}
                    placeholder="599"
                    className="input w-full"
                  />
                  <p className="text-[0.7rem] text-muted mt-0.5">Shown struck through as discount</p>
                </div>
              </div>
            )}
          </div>

          {/* Free Download Option */}
          <div className="p-4 rounded-xl border border-line bg-paper/40">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="is_free"
                checked={isFree}
                onChange={(e) => setIsFree(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-line text-success focus:ring-success"
              />
              <div>
                <span className="text-sm font-semibold text-ink">Available for Free Download</span>
                <p className="text-xs text-muted">
                  Enables free download access or free copy request form for this book.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* 4. Content & Presentation Details */}
      <div className="card p-6 sm:p-8 space-y-6">
        <h2 className="font-serif text-xl font-medium text-ink border-b border-line pb-3">
          4. Content Details &amp; Aesthetics
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Key Learnings */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              What Readers Will Learn (One per line)
            </label>
            <textarea
              name="learn"
              rows={4}
              defaultValue={initialData?.learn ? initialData.learn.join("\n") : ""}
              placeholder="How thoughts, emotions and actions influence one another&#10;Why people respond differently to the same situation..."
              className="input w-full text-xs font-sans resize-y"
            />
          </div>

          {/* Topics */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Topics &amp; Keywords (One per line)
            </label>
            <textarea
              name="topics"
              rows={4}
              defaultValue={initialData?.topics ? initialData.topics.join("\n") : ""}
              placeholder="Human behaviour&#10;Emotions &amp; Habits&#10;Everyday Psychology..."
              className="input w-full text-xs font-sans resize-y"
            />
          </div>

          {/* Cover Background */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Cover Background Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={coverBg}
                onChange={(e) => setCoverBg(e.target.value)}
                className="h-10 w-12 rounded border border-line cursor-pointer p-0.5"
              />
              <input
                type="text"
                name="cover_bg"
                value={coverBg}
                onChange={(e) => setCoverBg(e.target.value)}
                className="input font-mono text-xs w-full"
              />
            </div>
          </div>

          {/* Cover Accent */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Cover Accent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={coverAccent}
                onChange={(e) => setCoverAccent(e.target.value)}
                className="h-10 w-12 rounded border border-line cursor-pointer p-0.5"
              />
              <input
                type="text"
                name="cover_accent"
                value={coverAccent}
                onChange={(e) => setCoverAccent(e.target.value)}
                className="input font-mono text-xs w-full"
              />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Disclaimer (Optional)
            </label>
            <textarea
              name="disclaimer"
              rows={2}
              defaultValue={initialData?.disclaimer || ""}
              placeholder="This book is intended for general educational purposes..."
              className="input w-full text-xs resize-y"
            />
          </div>

          {/* Flags */}
          <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="adults_only"
                defaultChecked={initialData?.adults_only ?? false}
                className="h-4 w-4 rounded border-line text-danger focus:ring-danger"
              />
              <span className="text-sm text-ink">Adults Only (18+)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="hide_volume_label"
                defaultChecked={initialData?.hide_volume_label ?? false}
                className="h-4 w-4 rounded border-line text-gold focus:ring-gold"
              />
              <span className="text-sm text-ink">Hide &quot;Volume X&quot; Label in Title</span>
            </label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4 pt-4">
        <Link href="/admin/books" className="btn-outline px-6 py-2.5 text-sm font-medium">
          ← Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary px-8 py-3 text-sm font-semibold shadow-md disabled:opacity-50"
        >
          {isPending ? "Saving Book..." : isEdit ? "Update Book" : "Publish & Add Book"}
        </button>
      </div>
    </form>
  );
}
