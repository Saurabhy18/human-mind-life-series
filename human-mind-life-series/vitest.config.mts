import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: path.resolve(import.meta.dirname, "src") + "/" },
      // "server-only" throws outside React Server Components; in tests every module is server-side.
      { find: /^server-only$/, replacement: path.resolve(import.meta.dirname, "tests/support/empty.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/support/setup.ts"],
    // Each file gets its own process, database and storage folder.
    pool: "forks",
    isolate: true,
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
