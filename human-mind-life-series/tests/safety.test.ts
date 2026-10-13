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

  it("outside production Cashfree is pinned to SANDBOX (no real money locally)", async () => {
    // Even if someone asks for production, it is downgraded to sandbox unless NODE_ENV=production too.
    const { env } = await loadWith({ CASHFREE_ENV: "production" });
    expect(env.ENV.payment.cashfreeEnv).toBe("sandbox");
  });

  it("configured credentials enable the gateway in development", async () => {
    const { pay } = await loadWith({ CASHFREE_CLIENT_ID: "cf_test_client", CASHFREE_SECRET_KEY: "cf_test_secret" });
    expect(pay.gatewayEnabled()).toBe(true);
  });

  it("the gateway stays off when any Cashfree setting is missing", async () => {
    const { pay } = await loadWith({ CASHFREE_SECRET_KEY: "" });
    expect(pay.gatewayEnabled()).toBe(false);
  });

  it("production talks to the real Cashfree API (address cannot be redirected)", async () => {
    const { env } = await loadWith({ NODE_ENV: "production", CASHFREE_ENV: "production", CASHFREE_API_BASE: "https://evil.example" });
    expect(env.ENV.payment.cashfreeEnv).toBe("production");
    expect(env.ENV.payment.cashfreeApiBase).toBe("https://api.cashfree.com/pg");
  });

  it("on Hostinger, private data is stored outside the folder that every deployment replaces", async () => {
    const { defaultStorageDir } = await import("@/lib/server/db");
    const path = await import("node:path");
    expect(defaultStorageDir("/home/u123/domains/books.com/hbuilds/current/nodejs")).toBe(path.join("/home/u123/domains/books.com", "storage"));
    expect(defaultStorageDir("/home/u123/domains/books.com/hbuilds/versions/abc/nodejs")).toBe(path.join("/home/u123/domains/books.com", "storage"));
    expect(defaultStorageDir("/srv/app")).toBe(path.join("/srv/app", "storage"));
  });
});
