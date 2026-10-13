import { NextResponse } from "next/server";
import { handleCashfreeWebhook } from "@/lib/server/paymentService";
import { logger, errorMessage } from "@/lib/server/logger";

export const runtime = "nodejs";

/**
 * POST /api/payment/webhook — called by the payment gateway (server to server).
 * The raw body is needed to verify the signature, so it is read as text.
 * No same-origin check here (the gateway is not the website); the HMAC signature is the authentication.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 256 * 1024) return NextResponse.json({ ok: false, message: "Too large" }, { status: 413 });
  try {
    const res = await handleCashfreeWebhook(raw, req.headers);
    return NextResponse.json(res.body, { status: res.status });
  } catch (err) {
    logger.error("Webhook processing error", { error: errorMessage(err) });
    // 500 → the gateway retries; idempotency makes the retry safe.
    return NextResponse.json({ ok: false, message: "Temporary error" }, { status: 500 });
  }
}
