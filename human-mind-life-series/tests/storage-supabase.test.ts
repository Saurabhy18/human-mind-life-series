import { afterEach, describe, expect, it } from "vitest";

describe("Supabase storage configuration", () => {
  const previous = {
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    BOOK_STORAGE_BUCKET: process.env.BOOK_STORAGE_BUCKET,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("accepts a Supabase bucket as the active storage driver", async () => {
    process.env.STORAGE_DRIVER = "supabase";
    process.env.SUPABASE_STORAGE_BUCKET = "site-files";
    delete process.env.BOOK_STORAGE_BUCKET;

    const { ENV } = await import("@/config/env.server");
    expect(ENV.storage.driver).toBe("supabase");
    expect(ENV.storage.bucket).toBe("site-files");
  });
});
