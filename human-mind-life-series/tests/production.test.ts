import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SignJWT } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getReq, jsonReq, ORIGIN, pngBytes, STORAGE, writeSourceBook } from "./support/helpers";
import { createOrder } from "./support/orders";

// Admin routes read the session cookie through next/headers; each test sets it here.
const session = vi.hoisted(() => ({ cookie: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "hm_admin" && session.cookie ? { name, value: session.cookie } : undefined) }),
  headers: async () => new Headers(),
}));

function adminJwt(secret = process.env.SESSION_SECRET!) {
  return new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
}

const params = <T>(p: T) => ({ params: Promise.resolve(p) });

beforeAll(async () => {
  await writeSourceBook("volume-6");
});

// ---------------------------------------------------------------- Free book --

async function requestFreeBook(email = `reader+${crypto.randomUUID().slice(0, 8)}@example.com`, origin = ORIGIN) {
  const { POST } = await import("@/app/api/free-requests/route");
  const res = await POST(jsonReq("/api/free-requests", { name: "Asha Reader", email, book: "volume-6", consent: "on" }, { origin }));
  return { res, body: (await res.json()) as { ok: boolean; ref: string; downloadUrl: string | null } };
}

async function freeDownload(token: string) {
  const { GET } = await import("@/app/api/free-download/[token]/route");
  return GET(getReq(`/api/free-download/${token}`), params({ token }));
}

const tokenOf = (url: string | null) => url!.split("/").pop()!;

describe("Free book (Volume 6)", () => {
  it("form submission issues a personal link that downloads the PDF; only its hash is stored", async () => {
    const { res, body } = await requestFreeBook();
    expect(res.status).toBe(200);
    expect(body.downloadUrl).toMatch(/^\/api\/free-download\/[A-Za-z0-9_-]{43}$/);
    const token = tokenOf(body.downloadUrl);

    const dl = await freeDownload(token);
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-type")).toBe("application/pdf");
    expect(dl.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await dl.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF");

    const { getDb } = await import("@/lib/server/db");
    const row = getDb().prepare("SELECT download_token_hash FROM free_requests WHERE ref = ?").get(body.ref) as { download_token_hash: string };
    expect(row.download_token_hash).toBe(crypto.createHash("sha256").update(token).digest("hex"));
    expect(row.download_token_hash).not.toContain(token);
  });

  it("rejects cross-site submissions", async () => {
    const { res } = await requestFreeBook(undefined, "https://evil.example");
    expect(res.status).toBe(403);
  });

  it("an expired link no longer downloads", async () => {
    const { body } = await requestFreeBook();
    const { getDb } = await import("@/lib/server/db");
    getDb().prepare("UPDATE free_requests SET download_expires_at = datetime('now', '-1 minute') WHERE ref = ?").run(body.ref);
    expect((await freeDownload(tokenOf(body.downloadUrl))).status).toBe(410);
  });

  it("a link stops working after FREE_DOWNLOAD_LIMIT uses", async () => {
    const { CONFIG } = await import("@/config/site.config");
    const { body } = await requestFreeBook();
    const token = tokenOf(body.downloadUrl);
    for (let i = 0; i < CONFIG.FREE_DOWNLOAD_LIMIT; i++) expect((await freeDownload(token)).status).toBe(200);
    expect((await freeDownload(token)).status).toBe(410);
  });

  it("each reader's link is separate; guessed, altered or malformed tokens download nothing", async () => {
    const a = await requestFreeBook();
    const b = await requestFreeBook();
    const ta = tokenOf(a.body.downloadUrl);
    const tb = tokenOf(b.body.downloadUrl);
    expect(ta).not.toBe(tb);

    // Expiring reader A's link does not affect reader B's.
    const { getDb } = await import("@/lib/server/db");
    getDb().prepare("UPDATE free_requests SET download_expires_at = datetime('now', '-1 minute') WHERE ref = ?").run(a.body.ref);
    expect((await freeDownload(ta)).status).toBe(410);
    expect((await freeDownload(tb)).status).toBe(200);

    expect((await freeDownload(crypto.randomBytes(32).toString("base64url"))).status).toBe(410);
    expect((await freeDownload(tb.slice(0, -1) + (tb.endsWith("A") ? "B" : "A"))).status).toBe(410);
    expect((await freeDownload("..%2F..%2Forders.db")).status).toBe(404);
  });
});

// ------------------------------------------------------------ Private files --

describe("Private files are never directly reachable", () => {
  it("/api/files serves nothing without a valid signature, and storage keys can't escape the folder", async () => {
    const { GET } = await import("@/app/api/files/[...key]/route");
    expect((await GET(getReq("/api/files/translations/x.pdf"), params({ key: ["translations", "x.pdf"] }))).status).toBe(403);
    const forged = await GET(getReq("/api/files/../orders.db?exp=9999999999&name=a.pdf&sig=abc"), params({ key: ["..", "orders.db"] }));
    expect([403, 404]).toContain(forged.status);

    const { getStorage } = await import("@/lib/server/storageService");
    await expect(getStorage().signedUrl("../orders.db", { ttlSeconds: 60, downloadName: "x.pdf" })).rejects.toThrow();
    await expect(getStorage().get("../../orders.db")).rejects.toThrow();
  });

  it("private data lives outside public/, and public/ holds no PDFs or databases", async () => {
    const { STORAGE_DIR, PRIVATE_BOOKS_DIR, SCREENSHOT_DIR } = await import("@/lib/server/db");
    const publicDir = path.resolve("public");
    for (const dir of [STORAGE_DIR, PRIVATE_BOOKS_DIR, SCREENSHOT_DIR]) expect(path.resolve(dir).startsWith(publicDir)).toBe(false);
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [e.name]));
    expect(walk(publicDir).filter((f) => /\.(pdf|db|sqlite)$/i.test(f))).toEqual([]);
  });

  it("admin-only routes refuse anonymous requests and forged sessions", async () => {
    const routes = {
      screenshot: () => import("@/app/api/admin/orders/[id]/screenshot/route").then((m) => m.GET(getReq("/x"), params({ id: "1" }))),
      ordersCsv: () => import("@/app/api/admin/export/route").then((m) => m.GET()),
      freeCsv: () => import("@/app/api/admin/free-requests/export/route").then((m) => m.GET()),
      backup: () => import("@/app/api/admin/backup/route").then((m) => m.GET()),
      bookPdf: () => import("@/app/api/admin/books/[slug]/pdf/route").then((m) => m.GET(getReq("/x"), params({ slug: "volume-6" }))),
      translation: () => import("@/app/api/admin/translations/[id]/file/route").then((m) => m.GET(getReq("/x"), params({ id: "1" }))),
    };
    for (const cookie of [undefined, await adminJwt("a-different-secret-that-is-at-least-32-chars-long")]) {
      session.cookie = cookie;
      for (const [name, call] of Object.entries(routes)) expect([name, (await call()).status]).toEqual([name, 401]);
    }
  });
});

// ------------------------------------------------- UPI order + screenshots --

async function upiOrder(screenshot: Uint8Array, name = "shot.png") {
  const { POST } = await import("@/app/api/orders/route");
  const form = new FormData();
  form.set("buyerName", "Ravi Kumar");
  form.set("email", `ravi+${crypto.randomUUID().slice(0, 8)}@example.com`);
  form.set("whatsapp", "9876543210");
  form.set("product", "volume-4");
  form.set("targetLanguage", "en");
  form.set("amountPaid", "299");
  form.set("utr", `UTR${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`);
  form.set("consent", "on");
  form.set("screenshot", new Blob([new Uint8Array(screenshot)], { type: "image/png" }), name);
  const res = await POST(new Request(`${ORIGIN}/api/orders`, { method: "POST", body: form, headers: { origin: ORIGIN, host: "shop.example.com", "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } }));
  return { res, body: (await res.json()) as { ref?: string } };
}

describe("UPI payment screenshots", () => {
  beforeAll(async () => {
    await writeSourceBook("volume-4");
  });

  it("are stored privately under a random name and shown only to the admin", async () => {
    const { res, body } = await upiOrder(pngBytes(), "../../public/evil.png");
    expect(res.status).toBe(200);
    const { getOrderByRef } = await import("@/lib/server/orders");
    const order = getOrderByRef(body.ref!)!;
    expect(order.screenshot_file).toMatch(/^[0-9a-f-]{36}\.png$/);
    const { SCREENSHOT_DIR } = await import("@/lib/server/db");
    expect(fs.existsSync(path.join(SCREENSHOT_DIR, order.screenshot_file))).toBe(true);

    const { GET } = await import("@/app/api/admin/orders/[id]/screenshot/route");
    session.cookie = undefined;
    expect((await GET(getReq("/x"), params({ id: String(order.id) }))).status).toBe(401);
    session.cookie = await adminJwt();
    const ok = await GET(getReq("/x"), params({ id: String(order.id) }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(ok.headers.get("cache-control")).toContain("no-store");
    session.cookie = undefined;
  });

  it("a non-image disguised as .png is rejected and nothing is stored", async () => {
    const { SCREENSHOT_DIR } = await import("@/lib/server/db");
    const before = fs.readdirSync(SCREENSHOT_DIR).length;
    const { res } = await upiOrder(new TextEncoder().encode("<html><script>alert(1)</script></html>"));
    expect(res.status).toBe(422);
    expect(fs.readdirSync(SCREENSHOT_DIR).length).toBe(before);
  });
});

// ------------------------------------------------------------------ Backups --

describe("Database backup", () => {
  it("gives the admin a complete, consistent JSON snapshot including recent orders", async () => {
    const o = await createOrder("volume-4", "en", { pay: false });
    session.cookie = await adminJwt();
    const { GET } = await import("@/app/api/admin/backup/route");
    const res = await GET();
    session.cookie = undefined;
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="orders-backup-\d{12}\.json"/);
    const text = await res.text();
    const snapshot = JSON.parse(text);
    expect(Array.isArray(snapshot.orders)).toBe(true);
    expect(snapshot.orders.some((row: any) => row.ref === o.ref)).toBe(true);
  });
});

// ------------------------------------------------------ Production config --

describe("Production configuration", () => {
  it("storage defaults stay out of folders that builds or deployments replace", async () => {
    const { defaultStorageDir, isEphemeralDir } = await import("@/lib/server/db");
    expect(defaultStorageDir("/srv/app/.next/standalone")).toBe(path.join("/srv/app", "storage"));
    expect(defaultStorageDir("/home/u1/domains/x.com/hbuilds/current/nodejs/.next/standalone")).toBe(path.join("/home/u1/domains/x.com", "storage"));
    expect(isEphemeralDir("/home/u1/domains/x.com/storage")).toBe(false);
    expect(isEphemeralDir("/home/u1/domains/x.com/hbuilds/current/nodejs/storage")).toBe(true);
    expect(isEphemeralDir("/home/u1/domains/x.com/public_html/storage")).toBe(true);
    expect(isEphemeralDir(STORAGE())).toBe(false);
  });

  it("NEXT_PUBLIC_SITE_URL drives canonical URLs, the sitemap and robots.txt", async () => {
    const saved = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "shop.example.org/";
    vi.resetModules();
    try {
      const site = await import("@/config/site.config");
      expect(site.SITE_URL).toBe("https://shop.example.org");
      expect(site.SITE_URL_IS_PLACEHOLDER).toBe(false);
      const sitemap = (await import("@/app/sitemap")).default();
      expect(sitemap.length).toBeGreaterThan(5);
      expect(sitemap.every((e) => e.url.startsWith("https://shop.example.org/"))).toBe(true);
      expect((await import("@/app/robots")).default().sitemap).toBe("https://shop.example.org/sitemap.xml");
    } finally {
      if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = saved;
      vi.resetModules();
    }
    expect((await import("@/config/site.config")).SITE_URL_IS_PLACEHOLDER).toBe(true);
  });
});

