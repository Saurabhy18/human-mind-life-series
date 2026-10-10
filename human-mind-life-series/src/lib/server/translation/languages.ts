import "server-only";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "@/config/env.server";
import { STORAGE_DIR } from "../db";
import { logger, errorMessage } from "../logger";
import { getTranslationService, type Language } from "./googleTranslationService";

/** The language every book is written in. */
export const SOURCE_LANGUAGE: Language = { code: "en", name: "English" };

const CACHE_FILE = path.join(STORAGE_DIR, "cache", "supported-languages.json");
let memory: { at: number; languages: Language[] } | null = null;

function readDiskCache(): Language[] | null {
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as { languages: Language[] };
    return Array.isArray(data.languages) && data.languages.length ? data.languages : null;
  } catch {
    return null;
  }
}

function writeDiskCache(languages: Language[]) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ savedAt: new Date().toISOString(), languages }));
  } catch (err) {
    logger.warn("Could not save language cache", { error: errorMessage(err) });
  }
}

/**
 * Languages a customer can choose. Fetched from Google Cloud Translation
 * (not a hard-coded list), cached for LANGUAGES_CACHE_HOURS, with the last
 * good list kept on disk in case Google is briefly unreachable.
 * English (the original) is always first. Without translation configured,
 * only English is offered.
 */
export async function getAvailableLanguages(): Promise<Language[]> {
  const svc = getTranslationService();
  if (!svc) return [SOURCE_LANGUAGE];

  const ttl = ENV.translation.languagesCacheHours * 3600_000;
  if (memory && Date.now() - memory.at < ttl) return memory.languages;

  let fetched: Language[] | null = null;
  try {
    fetched = await svc.getSupportedLanguages();
  } catch (err) {
    logger.error("getSupportedLanguages failed", { error: errorMessage(err) });
  }
  const list = fetched?.length ? fetched : readDiskCache();
  if (!list) return [SOURCE_LANGUAGE];

  const others = list
    .filter((l) => normalizeCode(l.code) !== SOURCE_LANGUAGE.code)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const languages = [SOURCE_LANGUAGE, ...others];
  if (fetched?.length) writeDiskCache(fetched);
  memory = { at: Date.now(), languages };
  return languages;
}

function normalizeCode(code: string) {
  return code.trim();
}

/** Validates a requested target language against the live supported list. Returns the canonical code or null. */
export async function resolveTargetLanguage(code: unknown): Promise<Language | null> {
  if (typeof code !== "string" || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(code.trim())) return null;
  const wanted = code.trim().toLowerCase();
  const languages = await getAvailableLanguages();
  return languages.find((l) => l.code.toLowerCase() === wanted) ?? null;
}

/** Right-to-left scripts (used when generating translated books). */
export function isRtl(code: string): boolean {
  return ["ar", "he", "iw", "fa", "ur", "ps", "sd", "ug", "yi", "dv", "ckb"].includes(code.split("-")[0].toLowerCase());
}

/** Tests only. */
export function clearLanguageCache() {
  memory = null;
}
