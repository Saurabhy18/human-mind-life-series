import { formatPrice, type Book } from "@/lib/products";
import { Price, type PriceProps } from "./Price";

/** A book's price: "FREE" for free books (styled by the caller), otherwise  ~~₹599~~  50% OFF  ₹299. */
export function BookPrice({ book, ...rest }: { book: Pick<Book, "price" | "free" | "originalPrice" | "currency"> } & Omit<PriceProps, "amount" | "originalPrice" | "currency">) {
  if (book.free) return <span className={rest.priceClassName}>{formatPrice(book)}</span>;
  return <Price amount={book.price} originalPrice={book.originalPrice} currency={book.currency} {...rest} />;
}
