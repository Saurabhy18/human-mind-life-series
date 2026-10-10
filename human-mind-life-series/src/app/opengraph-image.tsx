import { CONFIG } from "@/config/site.config";
import { OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = CONFIG.SITE_NAME;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgImage({
    eyebrow: "A Six-Volume Book Series",
    title: "Explore the Human Mind. Understand Life. Understand Yourself.",
    subtitle: CONFIG.SITE_NAME,
  });
}
