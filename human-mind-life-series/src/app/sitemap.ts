import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site.config";
import { ALL_BOOKS } from "@/lib/products";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, freq: "weekly" },
    { path: "/books", priority: 0.9, freq: "weekly" },
    ...ALL_BOOKS.map((b) => ({ path: `/books/${b.slug}`, priority: 0.9, freq: "weekly" as const })),
    { path: "/about", priority: 0.6, freq: "monthly" },
    { path: "/faq", priority: 0.6, freq: "monthly" },
    { path: "/contact", priority: 0.5, freq: "yearly" },
    { path: "/privacy-policy", priority: 0.2, freq: "yearly" },
    { path: "/terms-and-conditions", priority: 0.2, freq: "yearly" },
    { path: "/refund-policy", priority: 0.2, freq: "yearly" },
  ];
  return pages.map((p) => ({ url: `${SITE_URL}${p.path}`, lastModified: now, changeFrequency: p.freq, priority: p.priority }));
}
