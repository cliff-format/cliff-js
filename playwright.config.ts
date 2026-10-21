import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser",
  use: {
    baseURL: "http://127.0.0.1:4173",
  },
  webServer: {
    command: "node scripts/serve-dist.mjs",
    port: 4173,
    reuseExistingServer: process.env.CI !== "true",
  },
});
