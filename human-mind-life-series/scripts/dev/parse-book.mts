// Dev helper: prints the structure the PDF parser extracts from a book.
// Usage: npx tsx --conditions=react-server scripts/dev/parse-book.mts storage/books/volume-4.pdf
import { PdfParser } from "@/lib/server/translation/parsers/pdfParser";

const file = process.argv[2];
const content = await new PdfParser().extractContent(file);
const counts: Record<string, number> = {};
for (const b of content.blocks) counts[b.type] = (counts[b.type] ?? 0) + 1;
console.log("title:", content.title, "| page:", content.pageSize, "| blocks:", counts);
const show = Number(process.argv[3] ?? 40);
for (const b of content.blocks.slice(0, show)) {
  if (b.type === "heading") console.log(`H${b.level}: ${b.text}`);
  else if (b.type === "paragraph") console.log(`P: ${b.text.slice(0, 110)}${b.text.length > 110 ? "…" : ""}`);
  else if (b.type === "list") console.log(`${b.ordered ? "OL" : "UL"}(${b.items.length}): ${b.items.map((i) => i.slice(0, 50)).join(" || ")}`);
  else console.log(b.type, "pageIndex" in b ? b.pageIndex : "");
}
