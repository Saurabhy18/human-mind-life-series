import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getReq, writeSourceBook } from "./support/helpers";
import { createOrder, drainWorker } from "./support/orders";

beforeAll(async () => {
  await writeSourceBook("volume-4");
});
afterEach(() => {
  vi.useRealTimers();
});

async function download(ref: string, token: string) {
  const { GET } = await import("@/app/api/orders/[orderId]/download/route");
  const res = await GET(getReq(`/api/orders/${ref}/download`, { "x-order-token": token }), { params: Promise.resolve({ orderId: ref }) });
  return { status: res.status, body: await res.json() };
}

async function fetchFile(url: string) {
  const { GET } = await import("@/app/api/files/[...key]/route");
  const u = new URL(url, "https://shop.example.com");
  const key = u.pathname.replace(/^\/api\/files\//, "").split("/");
  return GET(getReq(u.pathname + u.search), { params: Promise.resolve({ key }) });
}

describe("GET /api/orders/:id/download", () => {
  it("unpaid order → DENIED", async () => {
    const o = await createOrder("volume-4", "fr", { pay: false });
    const r = await download(o.ref, o.token);
    expect(r.status).toBe(402);
    expect(r.body.code).toBe("NOT_PAID");
  });

  it("paid + processing → NOT READY", async () => {
    const o = await createOrder("volume-4", "es");
    expect(o.get().fulfillment_status).toBe("PROCESSING");
    const r = await download(o.ref, o.token);
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("NOT_READY");
  });

  it("paid + completed → ALLOWED with a short-lived signed URL that serves the PDF", async () => {
    const o = await createOrder("volume-4", "fr");
    await drainWorker();
    const r = await download(o.ref, o.token);
    expect(r.status).toBe(200);
    expect(r.body.downloadUrl).toMatch(/^\/api\/files\/translations\/volume-4\/fr\/v-[0-9a-f]{12}\.pdf\?exp=\d+&name=.+&sig=/);
    expect(r.body.expiresInSeconds).toBe(600);
    const file = await fetchFile(r.body.downloadUrl);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("application/pdf");
    expect(file.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await file.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
    expect(o.get().download_count).toBe(1);
  });

  it("expired signed URL → DENIED", async () => {
    const o = await createOrder("volume-4", "fr");
    await drainWorker();
    const { downloadUrl } = (await download(o.ref, o.token)).body;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 601_000);
    const file = await fetchFile(downloadUrl);
    expect(file.status).toBe(410);
  });

  it("tampered signed URL → DENIED", async () => {
    const o = await createOrder("volume-4", "fr");
    await drainWorker();
    const { downloadUrl } = (await download(o.ref, o.token)).body as { downloadUrl: string };
    expect((await fetchFile(downloadUrl.replace(/sig=[^&]+/, "sig=AAAA"))).status).toBe(403);
    expect((await fetchFile(downloadUrl.replace(/exp=\d+/, "exp=9999999999"))).status).toBe(403); // extending expiry breaks the signature
    expect((await fetchFile(downloadUrl.replace("/fr/", "/de/"))).status).toBe(403); // another file
  });

  it("invalid order id or another customer's token → DENIED (same response, no leaks)", async () => {
    const mine = await createOrder("volume-4", "fr");
    const theirs = await createOrder("volume-4", "fr");
    await drainWorker();
    expect((await download("HM-ZZZZZZZZ", mine.token)).status).toBe(404);
    expect((await download("not-an-id", mine.token)).status).toBe(404);
    expect((await download(theirs.ref, mine.token)).status).toBe(404);
    expect((await download(mine.ref, "A".repeat(43))).status).toBe(404);
    const { GET } = await import("@/app/api/orders/[orderId]/status/route");
    const s = await GET(getReq(`/api/orders/${theirs.ref}/status`, { "x-order-token": mine.token }), { params: Promise.resolve({ orderId: theirs.ref }) });
    expect(s.status).toBe(404);
    expect(JSON.stringify(await s.json())).not.toMatch(/@example\.com|Test Reader/);
  });

  it("download limit is enforced", async () => {
    const o = await createOrder("volume-4", "fr");
    await drainWorker();
    for (let i = 0; i < 5; i++) expect((await download(o.ref, o.token)).status).toBe(200);
    const r = await download(o.ref, o.token);
    expect(r.status).toBe(429);
    expect(r.body.code).toBe("LIMIT_REACHED");
  });

  it("access period ends after DOWNLOAD_ACCESS_HOURS", async () => {
    const o = await createOrder("volume-4", "fr");
    await drainWorker();
    const { getDb } = await import("@/lib/server/db");
    getDb().prepare("UPDATE orders SET access_expires_at = datetime('now', '-1 minute') WHERE id = ?").run(o.id);
    const r = await download(o.ref, o.token);
    expect(r.status).toBe(410);
    expect(r.body.code).toBe("EXPIRED");
  });

  it("every attempt is logged", async () => {
    const o = await createOrder("volume-4", "fr", { pay: false });
    await download(o.ref, o.token);
    const { getDb } = await import("@/lib/server/db");
    const logs = getDb().prepare("SELECT event FROM download_logs WHERE order_id = ?").all(o.id) as { event: string }[];
    expect(logs.map((l) => l.event)).toEqual(["denied:not_paid"]);
  });
});

describe("GET /api/orders/:id/status", () => {
  it("reports payment, fulfillment and progress for the customer's own order", async () => {
    const o = await createOrder("volume-4", "ja");
    const { GET } = await import("@/app/api/orders/[orderId]/status/route");
    const call = async () => (await GET(getReq(`/api/orders/${o.ref}/status`, { "x-order-token": o.token }), { params: Promise.resolve({ orderId: o.ref }) })).json();
    expect(await call()).toMatchObject({ success: true, orderId: o.ref, paymentStatus: "PAID", fulfillmentStatus: "PROCESSING", stage: "PREPARING" });
    await drainWorker();
    expect(await call()).toMatchObject({ fulfillmentStatus: "COMPLETED", stage: "READY", progress: 100 });
  });

  it("emails the customer a private link when the book is ready", async () => {
    const o = await createOrder("volume-4", "it");
    await drainWorker();
    const { sentEmailsForTests } = await import("@/lib/server/emailService");
    const mail = sentEmailsForTests.find((e) => e.text.includes(o.ref) && e.subject.includes("is ready"));
    expect(mail).toBeTruthy();
    expect(mail!.text).toMatch(new RegExp(`https://shop\\.example\\.com/order/status/${o.ref}#t=[A-Za-z0-9_-]{43}`));
    // The emailed token works for this order.
    const token = mail!.text.match(/#t=([A-Za-z0-9_-]{43})/)![1];
    expect((await download(o.ref, token)).status).toBe(200);
  });
});
