/**
 * Test environment: a throwaway storage folder per test file, the FAKE
 * translator (no Google credentials, no cost), Razorpay in test mode with a
 * known webhook secret (its API is mocked per test), and emails captured.
 * Runs before any app module is imported, so env.server.ts picks these up.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hm-test-"));
fs.mkdirSync(path.join(dir, "books"), { recursive: true });

Object.assign(process.env, {
  STORAGE_DIR: dir,
  SESSION_SECRET: "test-session-secret-0123456789-abcdefghijklmnopqrstuvwxyz",
  TRANSLATION_PROVIDER: "fake",
  TRANSLATION_SALES_ENABLED: "true",
  TRANSLATION_STRATEGY: process.env.TEST_TRANSLATION_STRATEGY || "text",
  TRANSLATION_RETRY_BASE_SECONDS: "1",
  // Tiny parts so the document strategy's split/merge is exercised by small test books.
  DOC_TRANSLATION_PAGES_PER_REQUEST: "2",
  TRANSLATION_MAX_ATTEMPTS: "3",
  PAYMENT_PROVIDER: "razorpay",
  RAZORPAY_KEY_ID: "rzp_test_key",
  RAZORPAY_KEY_SECRET: "rzp_test_secret",
  RAZORPAY_WEBHOOK_SECRET: "whsec_test_secret",
  RAZORPAY_API_BASE: "https://rzp.test",
  EMAIL_TRANSPORT: "json",
  EMAIL_FROM: "Books <books@example.com>",
  FRONTEND_URL: "https://shop.example.com",
  CHROMIUM_PATH: process.env.CHROMIUM_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  LOG_SILENT: "1",
});

(globalThis as unknown as { __TEST_STORAGE__: string }).__TEST_STORAGE__ = dir;
