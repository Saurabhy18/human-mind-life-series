import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/checkout", "/order/"] /* /lp/ ad pages use a noindex tag instead, so ad platforms can still review them */ }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
