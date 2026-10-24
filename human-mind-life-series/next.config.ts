
import type { NextConfig } from "next";
import path from "node:path";
import dns from "node:dns";

// Prefer IPv4 first to prevent network timeouts on networks/ISPs with
// broken or unreachable IPv6 routes.
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Ignore in environments where setDefaultResultOrder is unavailable.
}

const isProd = process.env.NODE_ENV === "production";
// Cashfree's hosted checkout (JS SDK + modal iframe) domains allowed in CSP.
const cfScript = " https://sdk.cashfree.com https://*.cashfree.com";
const cfConnect = " https://*.cashfree.com https://*.cashfree.net https://api.cashfree.com https://sandbox.cashfree.com";
const cfFrame = " https://*.cashfree.com https://payments.cashfree.com https://payments-test.cashfree.com https://sandbox.cashfree.com";
const cfForm = " https://*.cashfree.com https://sandbox.cashfree.com";

// Signed download URLs may point to a private Google Cloud Storage bucket.
const gcsConnect = process.env.BOOK_STORAGE_BUCKET
  ? " https://storage.googleapis.com"
  : "";

/**
 * Content-Security-Policy: allows this site plus Google Analytics / Ads
 * and Meta Pixel. Add other third-party domains here if required.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${
    isProd ? "" : " 'unsafe-eval'"
  } https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://connect.facebook.net${cfScript}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.doubleclick.net https://www.google.com https://www.googleadservices.com https://www.facebook.com https://connect.facebook.net${cfConnect}${gcsConnect}`,
  `frame-src https://www.googletagmanager.com https://td.doubleclick.net https://www.facebook.com${cfFrame}`,
  "frame-ancestors 'none'",
  `form-action 'self'${cfForm}`,
  "base-uri 'self'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://payments.cashfree.com" "https://payments-test.cashfree.com" "https://sandbox.cashfree.com")',
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,

  // Limit build worker parallelism and optimize module imports.
  experimental: {
    cpus: 2,
    optimizePackageImports: ["lucide-react", "@cashfreepayments/cashfree-js"],
  },

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },

  // Dev only: allow a public tunnel to reach the development server.
  ...(isProd
    ? {}
    : { allowedDevOrigins: ["*.trycloudflare.com"] }),

  // Optional custom build directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Prevent private runtime storage from being copied into the build.
  outputFileTracingExcludes: {
    "/*": ["./storage/**/*"],
    "/**": ["./storage/**/*"],
  },

  // Server-only packages loaded at runtime rather than bundled.
  serverExternalPackages: [
    "@google-cloud/translate",
    "@google-cloud/storage",
    "pdfjs-dist",
    "pdf-lib",
    "playwright-core",
    "nodemailer",
    "pg",
  ],

  turbopack: {
    // Pin Turbopack's root to this application directory.
    root: path.resolve(__dirname),
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
