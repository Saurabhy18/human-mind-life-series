"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { CONFIG } from "@/config/site.config";
import { captureAttribution } from "@/lib/tracking-params";

const GA_ID = CONFIG.GOOGLE_ANALYTICS_ID;
const ADS_ID = CONFIG.GOOGLE_ADS_ID;
const PIXEL_ID = CONFIG.META_PIXEL_ID;
const GTAG_ID = GA_ID || ADS_ID;

/**
 * Loads Google Analytics 4, Google Ads and Meta Pixel — each only if its ID is
 * set in src/config/site.config.ts. Also captures UTM parameters.
 */
export function Analytics() {
  const pathname = usePathname();
  const firstLoad = useRef(true);

  useEffect(() => {
    captureAttribution();
    // The Meta Pixel base code tracks the first PageView; track client-side navigations here.
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  // Never load ad trackers inside the private admin area.
  if (pathname?.startsWith("/admin")) return null;

  return (
    <>
      {GTAG_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
${GA_ID ? `gtag('config', '${GA_ID}');` : ""}
${ADS_ID ? `gtag('config', '${ADS_ID}');` : ""}`}
          </Script>
        </>
      )}
      {PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');`}
        </Script>
      )}
    </>
  );
}
