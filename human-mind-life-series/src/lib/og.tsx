import { ImageResponse } from "next/og";
import { CONFIG } from "@/config/site.config";

export const OG_SIZE = { width: 1200, height: 630 };

/** Shared design for generated social-sharing images (Facebook, WhatsApp, X, LinkedIn). */
export function renderOgImage({ eyebrow, title, subtitle, byline = "Six books · The Intimacy Code free", bg = "#0f1b2d", accent = "#c9a24f" }: { eyebrow: string; title: string; subtitle: string; byline?: string; bg?: string; accent?: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px 80px",
          background: `linear-gradient(135deg, ${bg} 0%, #0b1422 100%)`,
          color: "white",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 6, textTransform: "uppercase", color: accent, fontFamily: "sans-serif" }}>
          {eyebrow}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ width: 90, height: 3, background: accent, marginBottom: 36 }} />
          <div style={{ fontSize: title.length > 40 ? 64 : 78, lineHeight: 1.08, maxWidth: 1000 }}>{title}</div>
          <div style={{ marginTop: 28, fontSize: 30, color: "rgba(255,255,255,0.75)", fontFamily: "sans-serif", maxWidth: 950 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "rgba(255,255,255,0.7)", fontFamily: "sans-serif" }}>
          <span>{CONFIG.SITE_NAME}</span>
          <span>{byline}</span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
