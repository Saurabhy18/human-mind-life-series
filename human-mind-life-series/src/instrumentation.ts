/**
 * Runs once when the Next.js server starts.
 * - Logs configuration problems (storage, site URL, admin, checkout) to the runtime logs.
 * - RUN_WORKER_IN_SERVER=true starts the translation worker inside the website
 *   process (for hosts that can't run `npm run worker` separately).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { runStartupChecks } = await import("./lib/server/startupChecks");
  runStartupChecks();
  if (process.env.RUN_WORKER_IN_SERVER === "true") {
    const { startInServerWorker } = await import("./lib/server/translation/inServerWorker");
    startInServerWorker();
  }
}
