import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * True when the UPI QR image is available either in /public or in Supabase Storage.
 * Lets the payment page show a clear message instead of a broken image.
 */
export function upiQrAvailable(): boolean {
  for (const f of ["upi-qr.png", "qrcode.png"]) {
    const local = path.join(process.cwd(), "public", "images", f);
    try {
      if (fs.existsSync(local) && fs.statSync(local).size > 0) return true;
    } catch {}
  }
  return false;
}
