import { NextResponse } from "next/server";
import { contactSchema, fieldErrors } from "@/lib/validation";
import { createMessage } from "@/lib/server/orders";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, isSameOrigin } from "@/lib/server/request";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return NextResponse.json({ ok: false, message: "Invalid request origin." }, { status: 403 });

  const limit = rateLimit(`contact:${clientIp(req.headers)}`, 5, 15 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ ok: false, message: "Too many messages. Please try again later." }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  if (body.website) return NextResponse.json({ ok: true }); // honeypot

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Please correct the highlighted fields.", errors: fieldErrors(parsed.error) }, { status: 422 });
  }
  createMessage({ ...parsed.data, phone: parsed.data.phone || null });
  return NextResponse.json({ ok: true });
}
