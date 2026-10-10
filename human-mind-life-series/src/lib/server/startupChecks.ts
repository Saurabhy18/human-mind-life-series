import "server-only";
import { ENV } from "@/config/env.server";
import { SITE_URL_IS_PLACEHOLDER } from "@/config/site.config";
import { adminConfigured } from "./auth";
import { storageStatus } from "./db";
import { logger } from "./logger";

/**
 * Logged once when the server starts, so configuration mistakes show up in the
 * host's runtime logs (e.g. Hostinger → Runtime Logs) instead of failing silently.
 * Never logs secret values.
 */
export function runStartupChecks(): void {
  const storage = storageStatus();
  logger.info("Private storage", { dir: storage.dir, writable: storage.writable, fromEnv: storage.fromEnv });
  if (!storage.writable) logger.error("STORAGE_DIR is not writable — orders, uploads and downloads will fail. Fix the folder permissions or set STORAGE_DIR.");
  if (storage.ephemeral) logger.error("STORAGE_DIR is inside a build/deployment or public folder — data would be lost on redeploy or exposed. Set STORAGE_DIR to a persistent private folder.");

  if (!ENV.isProd) return;
  if (SITE_URL_IS_PLACEHOLDER) logger.warn("NEXT_PUBLIC_SITE_URL is not set — canonical URLs, the sitemap and emails point to a placeholder domain. Set it and rebuild.");
  if (!adminConfigured()) logger.warn("Admin login is disabled: set ADMIN_PASSWORD_HASH and SESSION_SECRET (npm run setup-admin).");
  if (ENV.payment.provider === "none") logger.warn("Checkout is closed (PAYMENT_PROVIDER is not set). Set PAYMENT_PROVIDER=manual_upi for UPI QR orders.");
}
