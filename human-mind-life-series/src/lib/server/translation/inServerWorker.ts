import "server-only";
import { ENV, translationEnabled } from "@/config/env.server";
import { logger, errorMessage } from "../logger";
import { runWorkerOnce } from "./worker";

const globalForWorker = globalThis as unknown as { __hmWorker?: boolean };

/**
 * Runs the translation worker loop inside the website's own process
 * (RUN_WORKER_IN_SERVER=true). For hosts that run only one process, such as
 * Hostinger Business/Cloud Node.js hosting. On a VPS prefer `npm run worker`.
 * Safe alongside other workers or app instances: jobs are claimed atomically.
 */
export function startInServerWorker(): void {
  if (globalForWorker.__hmWorker) return;
  if (!translationEnabled()) {
    logger.info("In-server translation worker not started: translation is not configured");
    return;
  }
  globalForWorker.__hmWorker = true;
  logger.info("In-server translation worker started", { provider: ENV.translation.provider, strategy: ENV.translation.strategy, pollSeconds: ENV.worker.pollSeconds });

  const loop = async () => {
    let didWork = false;
    try {
      didWork = await runWorkerOnce();
    } catch (err) {
      logger.error("In-server worker loop error", { error: errorMessage(err) });
    }
    setTimeout(loop, didWork ? 0 : ENV.worker.pollSeconds * 1000).unref();
  };
  setTimeout(loop, 0).unref();
}
