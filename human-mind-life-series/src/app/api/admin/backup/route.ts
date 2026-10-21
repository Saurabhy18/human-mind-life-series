import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isAdmin } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { logger, errorMessage } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only download of a consistent JSON snapshot of database tables.
 * Use it before every deployment and on a schedule.
 */
export async function GET() {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const tmp = path.join(os.tmpdir(), `hm-backup-${crypto.randomUUID()}.json`);
  try {
    await getDb().backup(tmp);
    const data = await fs.readFile(tmp);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="orders-backup-${stamp}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    logger.error("Database backup failed", { error: errorMessage(err) });
    return new Response("Backup failed. Check the runtime logs.", { status: 500, headers: { "Cache-Control": "private, no-store" } });
  } finally {
    await fs.rm(tmp, { force: true });
  }
}
