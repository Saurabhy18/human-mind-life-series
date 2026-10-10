/**
 * Minimal structured logger. Never pass secrets, tokens, full emails or
 * payment screenshots to it — log ids and references instead.
 */
type Level = "info" | "warn" | "error";

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  if (process.env.LOG_SILENT === "1") return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, message, ...(meta ?? {}) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (m: string, meta?: Record<string, unknown>) => write("info", m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => write("warn", m, meta),
  error: (m: string, meta?: Record<string, unknown>) => write("error", m, meta),
};

/** Turns any thrown value into a short message safe for logs/admin (no stack, trimmed). */
export function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 500);
}
