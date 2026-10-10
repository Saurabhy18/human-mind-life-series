import { NextResponse } from "next/server";
import { getAvailableLanguages } from "@/lib/server/translation/languages";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/languages — languages a customer can order, from Google Cloud Translation's live supported list. */
export async function GET(req: Request) {
  if (!rateLimit(`langs:${clientIp(req.headers)}`, 60, 60_000).ok) {
    return NextResponse.json({ success: false, message: "Too many requests." }, { status: 429 });
  }
  const languages = await getAvailableLanguages();
  return NextResponse.json({ success: true, languages }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } });
}
