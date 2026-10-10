import { CONFIG, isPlaceholder, shouldShow } from "@/config/site.config";
import { whatsappLink } from "@/lib/contact";
import { IconFacebook, IconInstagram, IconWhatsApp, IconYouTube } from "./icons";

/**
 * Social buttons. Links still set to "[PLACEHOLDER]" are hidden in production
 * and shown with a dashed outline in development so you can see where they go.
 */
export function SocialLinks({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const wa = whatsappLink();
  const links = [
    { label: "Instagram", url: CONFIG.INSTAGRAM_URL, Icon: IconInstagram },
    { label: "Facebook", url: CONFIG.FACEBOOK_URL, Icon: IconFacebook },
    { label: "YouTube", url: CONFIG.YOUTUBE_URL, Icon: IconYouTube },
    { label: "WhatsApp", url: wa ?? CONFIG.WHATSAPP_NUMBER, Icon: IconWhatsApp },
  ].filter((l) => shouldShow(l.url));

  if (!links.length) return null;

  const base =
    tone === "light"
      ? "border-white/20 text-white/80 hover:border-white/60 hover:text-white"
      : "border-ink/15 text-ink/70 hover:border-ink/40 hover:text-ink";

  return (
    <ul className="flex items-center gap-3">
      {links.map(({ label, url, Icon }) => {
        const placeholder = isPlaceholder(url);
        return (
          <li key={label}>
            <a
              href={placeholder ? undefined : url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={placeholder ? `${label}: placeholder — set it in src/config/site.config.ts` : label}
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${base} ${placeholder ? "border-dashed opacity-60" : ""}`}
            >
              <Icon />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
