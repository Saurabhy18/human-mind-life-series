import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { CONFIG, SITE_URL } from "@/config/site.config";
import { Analytics } from "@/components/tracking/Analytics";
import { CurrencyProvider } from "@/components/currency/CurrencyContext";
import { ALL_BOOKS } from "@/lib/products";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${CONFIG.SITE_NAME} — Psychology & Personal Growth Books`,
    template: `%s | ${CONFIG.SITE_NAME}`,
  },
  description:
    "A six-volume series of psychology and personal growth books exploring human behaviour, human nature, relationships and the art of living well.",
  applicationName: CONFIG.SITE_NAME,
  authors: ALL_BOOKS.map((b) => ({ name: b.author })),
  creator: CONFIG.PUBLISHER_NAME,
  publisher: CONFIG.SITE_NAME,
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: { siteName: CONFIG.SITE_NAME, locale: "en_IN", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0f1b2d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-dvh">
        <CurrencyProvider>{children}</CurrencyProvider>
        <Analytics />
      </body>
    </html>
  );
}
