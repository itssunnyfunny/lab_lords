import path from "node:path";
import { defineConfig } from "@playwright/test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "billing.spec.ts",
  outputDir: path.join(repositoryRoot, "test-results/billing-verification/browser"),
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json", { outputFile: path.join(repositoryRoot, "test-results/billing-verification/browser-results.json") }]],
  use: {
    baseURL: "http://127.0.0.1:4189",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    contextOptions: { reducedMotion: "reduce" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 1024 } } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "mobile-320", use: { viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "node tests/billing-verification/server.mjs",
    cwd: repositoryRoot,
    url: "http://127.0.0.1:4189",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
