import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("Pricing: Volumes 1–5 at ₹599 → 50% OFF → ₹299", () => {
  it("every paid volume costs exactly ₹299, shown against ₹599 with 50% OFF", async () => {
    const { PAID_BOOKS, getProduct } = await import("@/lib/products");
    const { discountPercent } = await import("@/config/packages");
    expect(PAID_BOOKS.map((b) => b.volume)).toEqual([1, 2, 3, 4, 5]);
    for (const b of PAID_BOOKS) {
      expect([b.volume, b.price, b.originalPrice, discountPercent(b.price, b.originalPrice)]).toEqual([b.volume, 299, 599, 50]);
      expect(getProduct(b.slug)?.price).toBe(299); // what checkout and the order API charge
    }
  });

  it("the free book is unchanged: FREE, no original price, no badge, no volume label", async () => {
    const { FREE_BOOKS } = await import("@/lib/products");
    expect(FREE_BOOKS).toHaveLength(1);
    expect(FREE_BOOKS[0]).toMatchObject({ title: "The Intimacy Code", price: 0, free: true, originalPrice: null, volumeLabel: null, label: "The Intimacy Code" });
  });

  it("bundle prices are left as configured", async () => {
    const { PACKAGES } = await import("@/config/packages");
    expect(PACKAGES.three_book_bundle).toMatchObject({ price: 649 });
    expect(PACKAGES.five_book_bundle).toMatchObject({ price: 999 });
    expect(PACKAGES.three_book_bundle.originalPrice).toBeUndefined();
    expect(PACKAGES.five_book_bundle.originalPrice).toBeUndefined();
  });

  it("the badge never overstates the discount (₹299 of ₹599 is 50.08% → 50%)", async () => {
    const { discountPercent } = await import("@/config/packages");
    expect(discountPercent(299, 599)).toBe(50);
    expect(discountPercent(300, 599)).toBe(49);
    expect(discountPercent(299, null)).toBe(0);
    expect(discountPercent(599, 299)).toBe(0);
  });

  it("the UPI app link asks for exactly ₹299", async () => {
    const { upiPayLink } = await import("@/lib/contact");
    const link = upiPayLink(299, "Volume 1");
    if (link) expect(new URL(link.replace(/^upi:\/\//, "https://x/")).searchParams.get("am")).toBe("299.00");
  });

  it("renders  ~~₹599~~  50% OFF  ₹299  — never ₹299.50 — and plain FREE for the free book", async () => {
    const { Price } = await import("@/components/Price");
    const { BookPrice } = await import("@/components/BookPrice");
    const { PAID_BOOKS, FREE_BOOKS } = await import("@/lib/products");

    const html = renderToStaticMarkup(createElement(BookPrice, { book: PAID_BOOKS[0], priceClassName: "font-serif" }));
    expect(html).toMatch(/<s [^>]*>₹599<\/s>/);
    expect(html).toContain(">50% OFF<");
    expect(html).toContain('<span class="font-serif">₹299</span>');
    expect(html.indexOf("₹599")).toBeLessThan(html.indexOf("50% OFF"));
    expect(html.indexOf("50% OFF")).toBeLessThan(html.indexOf("₹299<"));
    expect(html).not.toContain("299.5");

    const free = renderToStaticMarkup(createElement(BookPrice, { book: FREE_BOOKS[0], priceClassName: "text-success" }));
    expect(free).toBe('<span class="text-success">FREE</span>');

    // Bundles have no original price, so they render exactly as before.
    expect(renderToStaticMarkup(createElement(Price, { amount: 649 }))).toBe("<span class=\"\">₹649</span>");
  });
});

describe("Daily offer countdown (IST)", () => {
  const ist = (s: string) => Date.parse(`${s}+05:30`); // an exact instant in India Standard Time
  const hms = async (t: number) => {
    const { offerCountdown } = await import("@/lib/dailyOffer");
    const c = offerCountdown(t);
    return [c.hours, c.minutes, c.seconds].map((n) => String(n).padStart(2, "0")).join(":");
  };

  it("counts down to 11:59:59 PM IST and restarts at 12:00 AM IST", async () => {
    expect(await hms(ist("2026-10-10T00:00:00.000"))).toBe("23:59:59");
    expect(await hms(ist("2026-10-10T15:30:00.000"))).toBe("08:29:59");
    expect(await hms(ist("2026-10-10T23:59:58.000"))).toBe("00:00:01");
    expect(await hms(ist("2026-10-10T23:59:59.000"))).toBe("00:00:00");
    expect(await hms(ist("2026-10-10T23:59:59.999"))).toBe("00:00:00");
    expect(await hms(ist("2026-10-11T00:00:00.000"))).toBe("23:59:59"); // new day, fresh countdown
  });

  it("runs every day indefinitely, for the IST date (not the visitor's own time zone)", async () => {
    const { offerDay, msUntilNextIstMidnight } = await import("@/lib/dailyOffer");
    for (const day of ["2026-10-10", "2026-10-11", "2026-10-12", "2027-03-01", "2030-12-31"]) {
      const noon = ist(`${day}T12:00:00.000`);
      expect(offerDay(noon)).toBe(day);
      expect(await hms(noon)).toBe("11:59:59");
      expect(msUntilNextIstMidnight(noon)).toBe(12 * 3600_000);
    }
    // 11 PM in London on 10 Oct is already 3:30 AM on 11 Oct in India.
    expect(offerDay(Date.parse("2026-10-10T23:00:00+01:00"))).toBe("2026-10-11");
  });

  it("is a pure function of the clock, so refreshing or reopening never resets it", async () => {
    const t = ist("2026-10-10T19:45:12.300");
    expect(await hms(t)).toBe(await hms(t));
    expect(await hms(t + 1000)).toBe("04:14:46");
  });

  it("renders the offer, the IST countdown placeholders before the clock starts, and nothing price-related changes", async () => {
    const { OfferCountdown } = await import("@/components/OfferCountdown");
    const banner = renderToStaticMarkup(createElement(OfferCountdown, { variant: "banner", scope: "Volumes 1–5" }));
    expect(banner).toContain("50% OFF");
    expect(banner).toContain("Limited Time Offer");
    expect(banner).toContain("Offer ends in:");
    expect(banner).toContain('role="timer"');
    expect(banner).toMatch(/Volumes 1–5: <s[^>]*>₹599<\/s>/);
    expect(banner).toContain("₹299");
    expect((banner.match(/>--</g) ?? []).length).toBe(3); // hours, minutes, seconds filled in by the browser clock
    expect(banner).not.toContain("299.5");
  });
});
