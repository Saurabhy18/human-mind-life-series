import { CONFIG, isPlaceholder } from "@/config/site.config";

export function whatsappLink(message?: string, number: string = CONFIG.WHATSAPP_NUMBER): string | null {
  if (isPlaceholder(number)) return null;
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function mailtoLink(to: string, subject?: string, body?: string): string | null {
  if (isPlaceholder(to)) return null;
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const q = params.toString().replace(/\+/g, "%20");
  return `mailto:${to}${q ? `?${q}` : ""}`;
}

/** UPI intent link — opens the buyer's UPI app with payee and amount filled in. */
export function upiPayLink(amount: number, note: string): string | null {
  if (isPlaceholder(CONFIG.UPI_ID)) return null;
  const params = new URLSearchParams({
    pa: CONFIG.UPI_ID,
    pn: isPlaceholder(CONFIG.UPI_PAYEE_NAME) ? CONFIG.SITE_NAME : CONFIG.UPI_PAYEE_NAME,
    am: amount.toFixed(2),
    cu: "INR",
    tn: note.slice(0, 50),
  });
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}
