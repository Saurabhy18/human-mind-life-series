/**
 * Format-independent representation of a book, so new source formats
 * (EPUB, DOCX, TXT) only need a new BookParser and new output formats only
 * need a new BookGenerator.
 */
export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  /** A page of the original that has no extractable text (cover, full-page image) — copied unchanged. */
  | { type: "originalPage"; pageIndex: number }
  | { type: "pageBreak" };

export type BookContent = {
  title: string;
  language: string;
  /** Page size of the source, in PDF points, so the translation keeps the same trim size. */
  pageSize: { width: number; height: number };
  blocks: Block[];
  /** Path of the source file, needed to copy original (image-only) pages. */
  sourcePath: string;
};

export interface BookParser {
  extractContent(filePath: string): Promise<BookContent>;
}

export interface BookGenerator {
  generate(content: BookContent, outputPath: string): Promise<string>;
}

/** Every translatable string in a book, in reading order, with a setter to write the translation back. */
export function translatableSegments(content: BookContent): { get: () => string; set: (v: string) => void }[] {
  const out: { get: () => string; set: (v: string) => void }[] = [];
  out.push({ get: () => content.title, set: (v) => (content.title = v) });
  for (const block of content.blocks) {
    if (block.type === "heading" || block.type === "paragraph") {
      out.push({ get: () => block.text, set: (v) => (block.text = v) });
    } else if (block.type === "list") {
      block.items.forEach((_, i) => out.push({ get: () => block.items[i], set: (v) => (block.items[i] = v) }));
    }
  }
  // Numbers, page references and empty strings don't need translating (and don't cost anything).
  return out.filter((s) => /\p{L}/u.test(s.get()));
}
