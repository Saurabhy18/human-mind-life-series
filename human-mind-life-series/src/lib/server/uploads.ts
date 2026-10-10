import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { SCREENSHOT_DIR } from "./db";

export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5 MB

type ImageType = { mime: string; ext: string };

/**
 * Detects the real file type from its first bytes ("magic numbers") instead of
 * trusting the browser-supplied name or MIME type.
 */
function sniffImage(buf: Buffer): ImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: "image/png", ext: "png" };
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return { mime: "image/webp", ext: "webp" };
  return null;
}

export type SavedFile = { fileName: string; mime: string };

export class UploadError extends Error {}

export async function saveScreenshot(file: File): Promise<SavedFile> {
  if (file.size === 0) throw new UploadError("Please attach your payment screenshot.");
  if (file.size > MAX_SCREENSHOT_BYTES) throw new UploadError("The screenshot is too large. Maximum size is 5 MB.");

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImage(buf);
  if (!type) throw new UploadError("Please upload a JPG, PNG or WEBP image of your payment screenshot.");

  // Random, unguessable file name — the original name is never used on disk.
  const fileName = `${crypto.randomUUID()}.${type.ext}`;
  // Recreate the folder if it was removed (e.g. storage moved or restored from backup).
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ SCREENSHOT_DIR, fileName), buf, { flag: "wx" });
  return { fileName, mime: type.mime };
}

export async function deleteScreenshot(fileName: string): Promise<void> {
  await fs.rm(resolveScreenshotPath(fileName), { force: true });
}

/** Resolves a stored file name safely (rejects anything that could escape the folder). */
export function resolveScreenshotPath(fileName: string): string {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(fileName)) throw new Error("Invalid file name");
  return path.join(SCREENSHOT_DIR, fileName);
}
