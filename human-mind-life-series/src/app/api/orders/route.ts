import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fieldErrors, orderSchema, sanitizeTracking } from "@/lib/validation";
import { createOrder, getOrder, upsertCustomer, utrExists, type NewOrder } from "@/lib/server/orders";
import { deleteScreenshot, MAX_SCREENSHOT_BYTES, saveScreenshot, UploadError } from "@/lib/server/uploads";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, hashIp, isSameOrigin } from "@/lib/server/request";
import { parseItemsField, readSelection, validatePurchase, type ValidPurchase } from "@/lib/server/purchase";
import { issueAccessToken } from "@/lib/server/fulfillment";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { checkoutMode, gatewayEnabled, upiEnabled } from "@/lib/server/paymentService";
import { logger, errorMessage } from "@/lib/server/logger";

export const runtime = "nodejs";

function fail(status: number, message: string, errors?: Record<string, string>) {
  return NextResponse.json({ ok: false, success: false, message, errors }, { status });
}

/** The order fields that come from the validated purchase — package, ebooks, languages and the SERVER's price. */
function purchaseFields(p: ValidPurchase): Pick<NewOrder, "package_type" | "product_slug" | "product_title" | "amount" | "author" | "currency" | "source_language" | "target_language" | "items"> {
  return {
    package_type: p.packageId,
    product_slug: p.productSlug,
    product_title: p.productTitle,
    amount: p.amount,
    author: p.author,
    currency: p.currency,
    source_language: p.items[0].source_language,
    target_language: p.items[0].target_language,
    items: p.items.map((i) => ({ book_slug: i.book_slug, book_title: i.book_title, author: i.author, source_language: i.source_language, target_language: i.target_language })),
  };
}

/**
 * POST /api/orders
 *  - multipart/form-data → UPI QR flow: "Payment completed?" submission (UTR + screenshot), verified by the admin.
 *  - application/json    → payment-gateway flow: creates a PENDING order before checkout (only when a gateway is enabled).
 * Both take a package and its ebooks with a language each: { packageId, items: [{ bookId, language }] }.
 * The amount is calculated here from src/config/packages.ts — never taken from the browser.
 * In both cases the order is created UNPAID. Nothing here marks a payment as paid.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return fail(403, "Invalid request origin.");
  // No payment provider configured (the default): no orders, so no payment can be taken.
  if (checkoutMode() === "closed") return fail(403, "Online checkout is not open yet. No payment can be made on this website at the moment.");

  const ip = clientIp(req.headers);
  const limit = rateLimit(`order:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.ok) return fail(429, `Too many submissions. Please try again in ${Math.ceil(limit.retryAfterSec / 60)} minutes.`);

  const user = await getAuthenticatedUser();
  if (!user || !user.email) {
    return fail(401, "You must be signed in to place an order. Please log in or create an account to continue.", { auth: "login_required" });
  }

  if ((req.headers.get("content-type") || "").includes("application/json")) return createGatewayOrder(req, ip, user);
  return createUpiOrder(req, ip, user);
}

// ------------------------------------------------------------- Gateway flow --

const gatewayOrderSchema = z.object({
  packageId: z.unknown().optional(),
  items: z.unknown().optional(),
  // Older single-book form: { bookId, targetLanguage } = an Individual Ebook order.
  bookId: z.string().trim().max(80).optional(),
  targetLanguage: z.string().trim().max(20).optional(),
  customerName: z.string().trim().max(80).optional(),
  customerEmail: z.string().trim().toLowerCase().max(120).email("Please enter a valid email address.").optional(),
  consent: z.literal(true, { message: "Please accept the Terms to continue." }),
  tracking: z.unknown().optional(),
  website: z.string().optional(),
});

async function createGatewayOrder(req: Request, ip: string, user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>) {
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

  const selection = readSelection(data);
  const checked = await validatePurchase(selection.packageId, selection.items); // the price comes from the server
  if (!checked.ok) return fail(422, checked.message, { [checked.field]: checked.message });

  try {
    const customerEmail = user.email!.toLowerCase();
    const customerName = (data.customerName || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") || customerEmail.split("@")[0]).trim();
    const customerId = upsertCustomer({ email: customerEmail, name: customerName });
    const { id, ref } = createOrder({
      ...purchaseFields(checked.purchase),
      amount_paid: null,
      buyer_name: customerName,
      email: customerEmail,
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
      payment_provider: "cashfree",
      customer_id: customerId,
    });
    const order = getOrder(id)!;
    const token = issueAccessToken(id, "checkout");
    return NextResponse.json({
      success: true,
      ok: true,
      orderId: ref,
      packageId: order.package_type,
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

async function createUpiOrder(req: Request, ip: string, user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>) {
  if (!upiEnabled()) return fail(404, "Manual UPI payment is not enabled.");
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
    product: form.get("product") ?? undefined,
    amountPaid: form.get("amountPaid") ?? "",
    utr: form.get("utr") ?? "",
    consent: form.get("consent") ?? "",
  });
  if (!parsed.success) return fail(422, "Please correct the highlighted fields.", fieldErrors(parsed.error));
  const data = parsed.data;

  // Package, ebooks and languages are validated, and the price is set, on the server — never taken from the browser.
  const selection = readSelection({
    packageId: form.get("packageId") ?? undefined,
    items: parseItemsField(form.get("items")),
    product: data.product || undefined,
    targetLanguage: form.get("targetLanguage") ?? undefined,
  });
  const checked = await validatePurchase(selection.packageId, selection.items);
  if (!checked.ok) return fail(422, checked.message, { [checked.field]: checked.message });

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
    const customerEmail = user.email!.toLowerCase();
    const customerName = (data.buyerName || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") || customerEmail.split("@")[0]).trim();
    const customerId = upsertCustomer({ email: customerEmail, name: customerName, whatsapp: data.whatsapp || null });
    const { id, ref } = createOrder({
      ...purchaseFields(checked.purchase),
      amount_paid: data.amountPaid,
      buyer_name: customerName,
      email: customerEmail,
      whatsapp: data.whatsapp,
      utr: data.utr,
      screenshot_file: saved.fileName,
      screenshot_mime: saved.mime,
      utm_json: tracking ? JSON.stringify(tracking) : null,
      ip_hash: hashIp(ip),
      user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
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
