/**
 * Background translation worker. Run alongside the website:
 *   npm run worker
 * It polls the translation_jobs table, translates books with Google Cloud
 * Translation, stores them privately and marks the waiting orders ready.
 * Customers' HTTP requests never wait for a translation.
 *
 * To scale later, swap the SQLite polling for BullMQ/Redis, Cloud Tasks,
 * Pub/Sub or Cloud Run Jobs — runJob() stays the same.
 */
import nextEnv from "@next/env";

// Load .env / .env.local exactly like the website does, BEFORE any settings are read.
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const { ENV } = await import("@/config/env.server");
const { logger } = await import("@/lib/server/logger");
const { runWorkerOnce } = await import("@/lib/server/translation/worker");

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    logger.info(`Worker received ${sig}; finishing the current job then exiting`);
    stopping = true;
  });
}

logger.info("Translation worker started", { provider: ENV.translation.provider, strategy: ENV.translation.strategy, pollSeconds: ENV.worker.pollSeconds });
const once = process.argv.includes("--once");

while (!stopping) {
  let didWork = false;
  try {
    didWork = await runWorkerOnce();
  } catch (err) {
    logger.error("Worker loop error", { error: err instanceof Error ? err.message : String(err) });
  }
  if (once && !didWork) break;
  if (!didWork) await new Promise((r) => setTimeout(r, ENV.worker.pollSeconds * 1000));
}
process.exit(0);
