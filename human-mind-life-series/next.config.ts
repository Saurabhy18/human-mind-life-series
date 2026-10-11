import type { NextConfig } from "next";
import path from "node:path";

const isProd = process.env.NODE_ENV === "production";
// Razorpay's hosted checkout is only allowed when it is actually switched on.
const razorpay = process.env.PAYMENT_PROVIDER === "razorpay";
const rzpScript = razorpay ? " https://checkout.razorpay.com" : "";
const rzpConnect = razorpay ? " https://api.razorpay.com https://lumberjack.razorpay.com" : "";
const rzpFrame = razorpay ? " https://api.razorpay.com https://checkout.razorpay.com" : "";
// Signed download URLs may point at a private Google Cloud Storage bucket.
const gcsConnect = process.env.BOOK_STORAGE_BUCKET ? " https://storage.googleapis.com" : "";

/**
 * Content-Security-Policy: allows this site plus Google Analytics / Ads and
 * Meta Pixel. If you add another third-party script, add its domain here.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://connect.facebook.net${rzpScript}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.doubleclick.net https://www.google.com https://www.googleadservices.com https://www.facebook.com https://connect.facebook.net${rzpConnect}${gcsConnect}`,
  `frame-src https://www.googletagmanager.com https://td.doubleclick.net https://www.facebook.com${rzpFrame}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: `camera=(), microphone=(), geolocation=(), payment=(${razorpay ? `self "https://api.razorpay.com"` : ""})` },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Optional: build into another folder (e.g. NEXT_DIST_DIR=.next-test) so a test build doesn't clash with `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Private runtime data (orders.db, book PDFs, payment screenshots) must never be copied into a build
  // (e.g. the standalone output Hostinger builds), whatever the file tracer infers from storage paths.
  outputFileTracingExcludes: {
    "/*": ["./storage/**/*"],
    "/**": ["./storage/**/*"],
  },
  // Server-only packages loaded from node_modules at runtime instead of being bundled.
  serverExternalPackages: ["@google-cloud/translate", "@google-cloud/storage", "pdfjs-dist", "pdf-lib", "playwright-core", "nodemailer"],
  turbopack: {
    // Pin the Turbopack root to THIS app directory. Hostinger deploys the repo
    // root (which contains this app in a subfolder plus a stray lockfile), so
    // without this Turbopack infers the wrong root and the CSS pipeline fails
    // in production while processing globals.css.
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default nextConfig;
