import "server-only";
import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "@/config/site.config";

/**
 * True when the UPI QR image set in UPI_QR_CODE actually exists in /public.
 * Lets the payment page show a clear message instead of a broken image.
 */
export function upiQrAvailable(): boolean {
  const src = CONFIG.UPI_QR_CODE;
  if (!src || !src.startsWith("/")) return false;
  const file = path.join(process.cwd(), "public", ...src.split("/").filter(Boolean));
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}
