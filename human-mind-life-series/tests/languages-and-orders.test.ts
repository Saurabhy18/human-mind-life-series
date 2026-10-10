import { beforeAll, describe, expect, it } from "vitest";
import { getReq, jsonReq, ORIGIN, pngBytes, writeSourceBook } from "./support/helpers";

describe("GET /api/languages", () => {
  beforeAll(async () => {
    await writeSourceBook("volume-4");
  });

  it("returns the provider's supported languages, English (original) first, no secrets", async () => {
    const { GET } = await import("@/app/api/languages/route");
    const res = await GET(getReq("/api/languages"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.languages[0]).toEqual({ code: "en", name: "English" });
    const codes = body.languages.map((l: { code: string }) => l.code);
    expect(codes).toEqual(expect.arrayContaining(["fr", "es", "ja", "zh-CN", "hi"]));
    expect(JSON.stringify(body)).not.toMatch(/secret|key|credential|project/i);
  });

  it("validates a requested language against the supported list", async () => {
    const { resolveTargetLanguage } = await import("@/lib/server/translation/languages");
    expect((await resolveTargetLanguage("fr"))?.name).toBe("French");
    expect((await resolveTargetLanguage("zh-cn"))?.code).toBe("zh-CN");
    expect(await resolveTargetLanguage("xx")).toBeNull();
    expect(await resolveTargetLanguage("<script>")).toBeNull();
    expect(await resolveTargetLanguage(42)).toBeNull();
  });

  it("offers English only when no translation provider is configured", async () => {
    const svc = await import("@/lib/server/translation/googleTranslationService");
    const langs = await import("@/lib/server/translation/languages");
    const saved = svc.getTranslationService();
    svc.setTranslationServiceForTests(null);
    langs.clearLanguageCache();
    expect(await langs.getAvailableLanguages()).toEqual([{ code: "en", name: "English" }]);
    svc.setTranslationServiceForTests(saved);
    langs.clearLanguageCache();
  });
});

describe("GET /api/books/:bookId", () => {
  it("returns public book data without the private file path", async () => {
    const { GET } = await import("@/app/api/books/[bookId]/route");
    const res = await GET(getReq("/api/books/volume-4"), { params: Promise.resolve({ bookId: "volume-4" }) });
    const body = await res.json();
    expect(body.book).toMatchObject({ id: "volume-4", title: "Intimacy After 50", sourceLanguage: "en", price: 299, currency: "INR", multilingual: true });
    expect(JSON.stringify(body)).not.toMatch(/storage|\.pdf|books\//);
  });

  it("marks books without a source PDF as English-only", async () => {
    const { GET } = await import("@/app/api/books/[bookId]/route");
    const res = await GET(getReq("/api/books/the-psychology-of-human-behavior"), { params: Promise.resolve({ bookId: "the-psychology-of-human-behavior" }) });
    expect((await res.json()).book.multilingual).toBe(false);
  });

  it("404s for unknown books", async () => {
    const { GET } = await import("@/app/api/books/[bookId]/route");
    const res = await GET(getReq("/api/books/nope"), { params: Promise.resolve({ bookId: "nope" }) });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/orders (gateway JSON)", () => {
  const valid = { bookId: "volume-4", targetLanguage: "fr", customerName: "Asha Rao", customerEmail: "asha@example.com", consent: true };

  it("creates a PENDING order with the server's price", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const res = await POST(jsonReq("/api/orders", { ...valid, amount: 1, price: 1, paymentStatus: "PAID" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, packageId: "individual", amount: 299, currency: "INR", paymentRequired: true });
    expect(body.orderId).toMatch(/^HM-[A-Z0-9]{8}$/);
    expect(body.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const { getOrderByRef } = await import("@/lib/server/orders");
    const o = getOrderByRef(body.orderId)!;
    expect(o).toMatchObject({ payment_status: "PENDING", fulfillment_status: "NOT_STARTED", target_language: "fr", source_language: "en", amount: 299, package_type: "individual" });
  });

  it("rejects unsupported languages", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const res = await POST(jsonReq("/api/orders", { ...valid, targetLanguage: "xx" }));
    expect(res.status).toBe(422);
    expect((await res.json()).errors.languages).toBeTruthy();
  });

  it("books without a PDF on the server cannot be ordered, in any language", async () => {
    const { POST } = await import("@/app/api/orders/route");
    expect((await POST(jsonReq("/api/orders", { ...valid, bookId: "the-psychology-of-human-behavior" }))).status).toBe(422);
    expect((await POST(jsonReq("/api/orders", { ...valid, bookId: "the-psychology-of-human-behavior", targetLanguage: "en" }))).status).toBe(422);
  });

  it("rejects free books, unknown books, missing consent and cross-site requests", async () => {
    const { POST } = await import("@/app/api/orders/route");
    expect((await POST(jsonReq("/api/orders", { ...valid, bookId: "volume-6" }))).status).toBe(422);
    expect((await POST(jsonReq("/api/orders", { ...valid, bookId: "nope" }))).status).toBe(422);
    expect((await POST(jsonReq("/api/orders", { ...valid, consent: false }))).status).toBe(422);
    expect((await POST(jsonReq("/api/orders", valid, { origin: "https://evil.example" }))).status).toBe(403);
  });
});

describe("POST /api/orders (UPI multipart)", () => {
  it("stores the chosen language and returns the customer's status token", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const form = new FormData();
    form.set("buyerName", "Ravi Kumar");
    form.set("email", "ravi@example.com");
    form.set("whatsapp", "9876543210");
    form.set("product", "volume-4");
    form.set("targetLanguage", "hi");
    form.set("amountPaid", "299");
    form.set("utr", "UTR123456789");
    form.set("consent", "on");
    form.set("screenshot", new Blob([new Uint8Array(pngBytes())], { type: "image/png" }), "shot.png");
    const res = await POST(new Request(`${ORIGIN}/api/orders`, { method: "POST", body: form, headers: { origin: ORIGIN, host: "shop.example.com" } }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ref).toMatch(/^HM-/);
    expect(body.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const { getOrderByRef } = await import("@/lib/server/orders");
    expect(getOrderByRef(body.ref)).toMatchObject({ target_language: "hi", payment_status: "PENDING", payment_provider: "manual_upi" });
  });
});
