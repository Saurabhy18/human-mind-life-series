import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  const res = await updateSession(request);
  const { pathname } = request.nextUrl;

  const adminCookie = request.cookies.get("hm_admin")?.value;
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  // 1. Unauthenticated protection for /admin routes (except /admin/login)
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (!adminCookie && !hasAuthCookie) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Unauthenticated protection for customer routes (/orders, /profile, /dashboard)
  if (pathname.startsWith("/orders") || pathname.startsWith("/dashboard") || pathname.startsWith("/profile")) {
    if (!hasAuthCookie && !adminCookie) {
      const loginUrl = new URL(`/login?next=${encodeURIComponent(pathname)}`, request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (api/* - API routes manage their own authentication and cookies)
     * - static image formats (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|api(?:$|/).*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
