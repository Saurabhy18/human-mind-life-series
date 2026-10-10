import Image from "next/image";
import type { Book } from "@/lib/products";

type Props = {
  book: Book;
  size?: "xs" | "sm" | "md" | "lg";
  priority?: boolean;
  className?: string;
};

const SIZES = {
  xs: "96px",
  sm: "200px",
  md: "(max-width: 640px) 70vw, 280px",
  lg: "(max-width: 768px) 80vw, 420px",
};

/**
 * Shows the uploaded cover image, or — until one is provided in
 * site.config.ts — an elegant typographic cover built from the book's details.
 */
export function BookCover({ book, size = "md", priority, className = "" }: Props) {
  const frame = `relative aspect-[2/3] w-full overflow-hidden rounded-[6px] shadow-[0_24px_50px_-20px_rgba(15,27,45,0.55),0_2px_6px_rgba(15,27,45,0.15)] ${className}`;

  if (book.cover) {
    return (
      <div className={frame}>
        <Image
          src={book.cover}
          alt={`Cover of ${book.label} by ${book.author}`}
          fill
          sizes={SIZES[size]}
          priority={priority}
          className="object-contain"
        />
      </div>
    );
  }

  const { bg, accent } = book.coverTheme;

  // Thumbnails are too small for the title, so show just the volume number.
  if (size === "xs") {
    return (
      <div className={frame} style={{ background: bg }} role="img" aria-label={`Cover of ${book.label}`}>
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-black/35 to-transparent" />
        <div className="absolute inset-[9%] flex flex-col items-center justify-center border" style={{ borderColor: `${accent}66` }}>
          <span className="font-sans text-[0.45rem] font-semibold tracking-[0.2em] uppercase" style={{ color: accent }}>{book.volumeLabel ? "Vol." : "Free"}</span>
          {book.volumeLabel && <span className="font-serif text-2xl leading-none text-white">{book.volume}</span>}
        </div>
      </div>
    );
  }
  const titleSize = size === "sm" ? "text-[0.95rem]" : size === "md" ? "text-xl sm:text-2xl" : "text-2xl sm:text-[2.1rem]";
  const small = size === "sm";

  return (
    <div
      className={frame}
      style={{ background: `radial-gradient(120% 80% at 50% 0%, ${bg}cc 0%, ${bg} 55%), ${bg}` }}
      role="img"
      aria-label={`Cover of ${book.label}`}
    >
      {/* spine shadow */}
      <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/35 to-transparent" />
      <div className="absolute inset-[7%] flex flex-col items-center border text-center" style={{ borderColor: `${accent}66` }}>
        <p className={`mt-[9%] font-sans font-semibold tracking-[0.22em] uppercase ${small ? "text-[0.42rem]" : "text-[0.6rem]"}`} style={{ color: accent }}>
          The Human Mind &amp; Life Series
        </p>
        <div className="my-auto flex flex-col items-center px-[8%]">
          <p className={`font-serif italic ${small ? "text-[0.6rem]" : "text-sm"}`} style={{ color: `${accent}dd` }}>
            {book.volumeLabel ?? "Free Book"}
          </p>
          <span className="my-[10%] block h-px w-10" style={{ background: accent }} />
          <p className={`font-serif leading-tight font-medium text-white ${titleSize}`}>{book.title}</p>
        </div>
        <p className={`mb-[9%] font-sans tracking-[0.16em] text-white/80 uppercase ${small ? "text-[0.45rem]" : "text-[0.65rem]"}`}>
          {book.author}
        </p>
      </div>
    </div>
  );
}
