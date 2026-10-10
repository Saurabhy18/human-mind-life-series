#!/usr/bin/env node
/**
 * Creates/updates .env.local with a hashed admin password and a random session secret.
 *
 *   npm run setup-admin                 (asks for the password)
 *   npm run setup-admin -- "MyPassword" (non-interactive)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const envPath = path.join(process.cwd(), ".env.local");

async function askPassword() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const ask = (q) =>
    new Promise((resolve) => {
      rl.question(q, resolve);
    });
  const pw = await ask("Choose an admin password (min 10 characters): ");
  rl.close();
  return pw;
}

const password = process.argv[2] ?? (await askPassword());
if (!password || password.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
const values = {
  ADMIN_PASSWORD_HASH: `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`,
  SESSION_SECRET: crypto.randomBytes(48).toString("hex"),
};

let lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").split(/\r?\n/) : [];
for (const [key, value] of Object.entries(values)) {
  const line = `${key}=${value}`;
  const i = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (i >= 0) lines[i] = line;
  else lines.push(line);
}
lines = lines.filter((l, i, arr) => l.trim() !== "" || i < arr.length - 1);
fs.writeFileSync(envPath, lines.join("\n") + "\n", { mode: 0o600 });

console.log(`Saved ADMIN_PASSWORD_HASH and SESSION_SECRET to ${envPath}`);
console.log("Restart the server, then sign in at /admin/login. (All existing admin sessions are now logged out.)");
