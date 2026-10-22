"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Trash2 } from "lucide-react";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#912018] disabled:cursor-wait disabled:opacity-60"
    >
      <Trash2 size={15} />
      {pending ? "Deleting..." : "Yes, delete"}
    </button>
  );
}

export function DeleteBookButton({
  id,
  title,
  action,
}: {
  id: number;
  title: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        title="Delete book"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-danger/25 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition hover:border-danger hover:bg-danger hover:text-white"
      >
        <Trash2 size={13} />
        Delete
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`delete-book-${id}-title`}
        // Clicking the dimmed backdrop (the dialog element itself) closes it.
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-0 text-left shadow-2xl backdrop:bg-ink/50 backdrop:backdrop-blur-sm"
      >
        <form action={action} className="p-6">
          <input type="hidden" name="id" value={id} />
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
              <AlertTriangle size={22} />
            </span>
            <div className="min-w-0">
              <h2 id={`delete-book-${id}-title`} className="font-serif text-xl font-medium text-ink">
                Delete this book?
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                <span className="font-semibold text-ink">“{title}”</span> will be removed from the catalogue and
                the store. This cannot be undone.
              </p>
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-ink/80">
                <input type="checkbox" name="delete_pdf" value="true" className="h-4 w-4 accent-[#b42318]" />
                Also delete the PDF file from storage
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/40"
            >
              Cancel
            </button>
            <ConfirmButton />
          </div>
        </form>
      </dialog>
    </>
  );
}
