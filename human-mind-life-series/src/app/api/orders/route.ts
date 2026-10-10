import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getProduct } from "@/lib/products";
import { fieldErrors, orderSchema, sanitizeTracking } from "@/lib/validation";
import { createOrder, getOrder, upsertCustomer, utrExists } from "@/lib/server/orders";
import { deleteScreenshot, MAX_SCREENSHOT_BYTES, saveScreenshot, UploadError } from "@/lib/server/uploads";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, hashIp, isSameOrigin } from "@/lib/server/request";
import { validateOrderLanguage } from "@/lib/server/orderLanguage";
import { issueAccessToken } from "@/lib/server/fulfillment";
import { gatewayEnabled } from "@/lib/server/paymentService";
import { logger, errorMessage } from "@/lib/server/logger";

export const runtime = "nodejs";

function fail(status: number, message: string, errors?: Record<string, string>) {
  return NextResponse.json({ ok: false, success: false, message, errors }, { status });
}

/**
 * POST /api/orders
 *  - multipart/form-data → UPI QR flow: "Payment completed?" submission (UTR + screenshot), verified by the admin.
 *  - application/json    → payment-gateway flow: creates a PENDING order before checkout (only when a gateway is enabled).
 * In both cases the order is created UNPAID. Nothing here marks a payment as paid.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return fail(403, "Invalid request origin.");

  const ip = clientIp(req.headers);
  const limit = rateLimit(`order:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.ok) return fail(429, `Too many submissions. Please try again in ${Math.ceil(limit.retryAfterSec / 60)} minutes.`);

  if ((req.headers.get("content-type") || "").includes("application/json")) return createGatewayOrder(req, ip);
  return createUpiOrder(req, ip);
}

// ------------------------------------------------------------- Gateway flow --

const gatewayOrderSchema = z.object({
  bookId: z.string().trim().min(1).max(80),
  targetLanguage: z.string().trim().min(2).max(20),
  customerName: z.string().trim().min(2, "Please enter your full name.").max(80).regex(/^[\p{L}\p{M} .'-]+$/u, "Please use letters only in your name."),
  customerEmail: z.string().trim().toLowerCase().max(120).email("Please enter a valid email address."),
  consent: z.literal(true, { message: "Please accept the Terms to continue." }),
  tracking: z.unknown().optional(),
  website: z.string().optional(),
});

async function createGatewayOrder(req: Request, ip: string) {
  if (!gatewayEnabled()) return fail(404, "Online card/UPI checkout is not enabled.");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid request.");
  }
  const parsed = gatewayOrderSchema.safeParse(body);
  if (!parsed.success) return fail(422, "Please correct the highlighted fields.", fieldErrors(parsed.error));
  const data = parsed.data;
  if (data.website) return fail(400, "Invalid request.");

  const product = getProduct(data.bookId); // paid products only; price comes from the server
  if (!product) return fail(422, "This book is not available.", { bookId: "Unknown book." });
  const lang = await validateOrderLanguage(product.slug, data.targetLanguage);
  if (!lang.ok) return fail(422, lang.message, { targetLanguage: lang.message });

  try {
    const customerId = upsertCustomer({ email: data.customerEmail, name: data.customerName });
    const { id, ref } = createOrder({
      product_slug: product.slug,
      product_title: product.label,
      amount: product.price,
      amount_paid: null,
      author: product.author,
      buyer_name: data.customerName,
      email: data.customerEmail,
      whatsapp: "",
      // Gateway orders have no customer-entered UTR or screenshot; a unique placeholder keeps the schema's constraints.
      utr: `GW-${crypto.randomUUID()}`,
      screenshot_file: "",
      screenshot_mime: "",
      utm_json: (() => {
        const t = sanitizeTracking(data.tracking);
        return t ? JSON.stringify(t) : null;
      })(),
      ip_hash: hashIp(ip),
      user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
      source_language: lang.source,
      target_language: lang.language.code,
      currency: "INR",
      payment_provider: "razorpay",
      customer_id: customerId,
    });
    const order = getOrder(id)!;
    const token = issueAccessToken(id, "checkout");
    return NextResponse.json({
      success: true,
      ok: true,
      orderId: ref,
      amount: order.amount,
      currency: order.currency,
      paymentRequired: true,
      // Secret, customer-only token for this order's status/download (never logged).
      accessToken: token,
    });
  } catch (err) {
    logger.error("Gateway order creation failed", { error: errorMessage(err) });
    return fail(500, "Something went wrong. Please try again.");
  }
}

// ----------------------------------------------------------------- UPI flow --

async function createUpiOrder(req: Request, ip: string) {
  const length = Number(req.headers.get("content-length") || 0);
  if (length > MAX_SCREENSHOT_BYTES + 64 * 1024) return fail(413, "The screenshot is too large. Maximum size is 5 MB.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "Could not read the form. Please try again.");
  }

  // Honeypot: real visitors never see or fill this field.
  if (form.get("website")) return NextResponse.json({ ok: true, ref: "HM-RECEIVED" });

  const parsed = orderSchema.safeParse({
    buyerName: form.get("buyerName") ?? "",
    email: form.get("email") ?? "",
    whatsapp: form.get("whatsapp") ?? "",
    product: form.get("product") ?? "",
    amountPaid: form.get("amountPaid") ?? "",
    utr: form.get("utr") ?? "",
    consent: form.get("consent") ?? "",
  });
  if (!parsed.success) return fail(422, "Please correct the highlighted fields.", fieldErrors(parsed.error));
  const data = parsed.data;

  // The price always comes from the server-side catalogue, never from the browser.
  const product = getProduct(data.product);
  if (!product) return fail(422, "Please choose the book you purchased.", { product: "Please choose a valid book." });

  const lang = await validateOrderLanguage(product.slug, form.get("targetLanguage"));
  if (!lang.ok) return fail(422, lang.message, { targetLanguage: lang.message });

  if (utrExists(data.utr)) {
    return fail(409, "This UTR / Transaction ID has already been submitted.", {
      utr: "This UTR has already been submitted. If you believe this is a mistake, please contact us.",
    });
  }

  const file = form.get("screenshot");
  if (!(file instanceof File)) return fail(422, "Please attach your payment screenshot.", { screenshot: "Please attach your payment screenshot." });

  let saved;
  try {
    saved = await saveScreenshot(file);
  } catch (err) {
    if (err instanceof UploadError) return fail(422, err.message, { screenshot: err.message });
    logger.error("Screenshot save failed", { error: errorMessage(err) });
    return fail(500, "Something went wrong while uploading. Please try again.");
  }

  let tracking: Record<string, string> | null = null;
  try {
    tracking = sanitizeTracking(JSON.parse(String(form.get("tracking") || "null")));
  } catch {
    tracking = null;
  }

  try {
    const customerId = upsertCustomer({ email: data.email, name: data.buyerName, whatsapp: data.whatsapp });
    const { id, ref } = createOrder({
      product_slug: product.slug,
      product_title: product.label,
      amount: product.price,
      amount_paid: data.amountPaid,
      author: product.author,
      buyer_name: data.buyerName,
      email: data.email,
      whatsapp: data.whatsapp,
      utr: data.utr,
      screenshot_file: saved.fileName,
      screenshot_mime: saved.mime,
      utm_json: tracking ? JSON.stringify(tracking) : null,
      ip_hash: hashIp(ip),
      user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
      source_language: lang.source,
      target_language: lang.language.code,
      currency: "INR",
      payment_provider: "manual_upi",
      customer_id: customerId,
    });
    // Only the public reference and this customer's own secret status token are returned.
    return NextResponse.json({ ok: true, ref, accessToken: issueAccessToken(id, "checkout") });
  } catch (err) {
    await deleteScreenshot(saved.fileName).catch(() => {});
    if (err instanceof Error && err.message.includes("orders.utr")) {
      return fail(409, "This UTR / Transaction ID has already been submitted.", { utr: "This UTR has already been submitted." });
    }
    logger.error("Order creation failed", { error: errorMessage(err) });
    return fail(500, "Something went wrong. Please try again or contact us.");
  }
}
