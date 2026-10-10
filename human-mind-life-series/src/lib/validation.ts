import { z } from "zod";
import { CONTACT_TOPICS } from "./constants";

export { CONTACT_TOPICS };

const name = z
  .string()
  .trim()
  .min(2, "Please enter your full name.")
  .max(80, "Name is too long.")
  .regex(/^[\p{L}\p{M} .'-]+$/u, "Please use letters only in your name.");

const email = z.string().trim().toLowerCase().max(120).email("Please enter a valid email address.");

/** Accepts "+91 98765 43210", "09876543210", "9876543210" etc. Stored as digits with country code. */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

const whatsapp = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine((d) => d.length >= 11 && d.length <= 15, "Please enter a valid WhatsApp number (with country code if outside India).");

export const orderSchema = z.object({
  buyerName: name,
  email,
  whatsapp,
  /** Older single-book form only; the checkout now sends packageId + items (validated in lib/server/purchase.ts). */
  product: z.string().trim().max(80).optional(),
  amountPaid: z
    .string()
    .trim()
    .transform((v) => v.replace(/[₹,\s]/g, ""))
    .refine((v) => /^\d{1,6}(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Please enter the amount you paid, in rupees (e.g. 299).")
    .transform(Number),
  utr: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine((v) => /^[A-Z0-9]{8,35}$/.test(v), "Please enter the UTR / Transaction ID exactly as shown in your UPI app (letters and numbers only)."),
  consent: z.literal("on", { message: "Please confirm the declaration to continue." }),
});

export type OrderInput = z.infer<typeof orderSchema>;

/** "Get Free Book" form — no payment fields at all. WhatsApp is optional. */
export const freeRequestSchema = z.object({
  name,
  email,
  whatsapp: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? normalizePhone(v) : ""))
    .refine((d) => d === "" || (d.length >= 11 && d.length <= 15), "Please enter a valid WhatsApp number or leave it blank."),
  book: z.string().trim().min(1).max(80),
  consent: z.literal("on", { message: "Please confirm to continue." }),
});


export const contactSchema = z.object({
  name,
  email,
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? normalizePhone(v) : ""))
    .refine((d) => d === "" || (d.length >= 11 && d.length <= 15), "Please enter a valid phone number or leave it blank."),
  topic: z.enum(CONTACT_TOPICS, { message: "Please choose a topic." }),
  message: z.string().trim().min(10, "Please write a slightly longer message.").max(3000, "Message is too long (max 3000 characters)."),
});

/** Only these marketing parameters are accepted and stored with an order. */
export const TRACKING_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "landing_page",
  "referrer",
] as const;

export function sanitizeTracking(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, string> = {};
  for (const key of TRACKING_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim().slice(0, 200);
  }
  return Object.keys(out).length ? out : null;
}

/** Turns zod issues into { fieldName: "first message" } for the form UI. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
