import { afterEach, describe, expect, it, vi } from "vitest";

/** Settings are read once at import, so each case reloads the modules with its own environment. */
async function loadWith(env: Record<string, string>) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  vi.resetModules();
  const mods = { env: await import("@/config/env.server"), pay: await import("@/lib/server/paymentService") };
  process.env = saved;
  return mods;
}

afterEach(() => {
  vi.resetModules();
});

describe("Development / test safety", () => {
  it("the fake translator can never run in production", async () => {
    const { env } = await loadWith({ NODE_ENV: "production", TRANSLATION_PROVIDER: "fake" });
    expect(env.ENV.translation.provider).toBe("none");
  });

  it("Google translation is off unless a project id is configured", async () => {
    const { env } = await loadWith({ TRANSLATION_PROVIDER: "google", GOOGLE_CLOUD_PROJECT_ID: "" });
    expect(env.ENV.translation.provider).toBe("none");
  });

  it("outside production only Razorpay TEST keys are accepted (no real money locally)", async () => {
    const { pay } = await loadWith({ RAZORPAY_KEY_ID: "rzp_live_REALKEY" });
    expect(pay.gatewayEnabled()).toBe(false);
    expect(pay.razorpayKeyAllowed("rzp_live_x", false)).toBe(false);
    expect(pay.razorpayKeyAllowed("rzp_test_x", false)).toBe(true);
    expect(pay.razorpayKeyAllowed("rzp_live_x", true)).toBe(true);
  });

  it("test keys enable the gateway in development", async () => {
    const { pay } = await loadWith({ RAZORPAY_KEY_ID: "rzp_test_key" });
    expect(pay.gatewayEnabled()).toBe(true);
  });

  it("the gateway stays off when any Razorpay setting is missing", async () => {
    const { pay } = await loadWith({ RAZORPAY_WEBHOOK_SECRET: "" });
    expect(pay.gatewayEnabled()).toBe(false);
  });

  it("production always talks to the real Razorpay API (address cannot be redirected)", async () => {
    const { env } = await loadWith({ NODE_ENV: "production", RAZORPAY_API_BASE: "https://evil.example" });
    expect(env.ENV.payment.razorpayApiBase).toBe("https://api.razorpay.com");
  });

  it("on Hostinger, private data is stored outside the folder that every deployment replaces", async () => {
    const { defaultStorageDir } = await import("@/lib/server/db");
    const path = await import("node:path");
    expect(defaultStorageDir("/home/u123/domains/books.com/hbuilds/current/nodejs")).toBe(path.join("/home/u123/domains/books.com", "storage"));
    expect(defaultStorageDir("/home/u123/domains/books.com/hbuilds/versions/abc/nodejs")).toBe(path.join("/home/u123/domains/books.com", "storage"));
    expect(defaultStorageDir("/srv/app")).toBe(path.join("/srv/app", "storage"));
  });
});
