import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const runId = process.env.AUDIT_BROWSER_RUN_ID;
if (!runId || !/^20260930-[a-z0-9-]+$/.test(runId)) {
  throw new Error("Set a unique AUDIT_BROWSER_RUN_ID beginning 20260930-");
}

const outputDir = path.resolve(".clerk", "audit-browser-runs", runId);
// start-local.mjs rejects an existing output path before Playwright starts.
// Playwright workers reload this config after the runner creates that path.

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117";
const target = new URL(baseURL);
if (target.protocol !== "http:" || target.hostname !== "localhost") {
  throw new Error("Audit browser requires the guarded localhost application");
}

for (const name of ["PLAYWRIGHT_OWNER_AUTH_STATE", "PLAYWRIGHT_STAFF_AUTH_STATE"] as const) {
  const state = process.env[name]?.replaceAll("\\", "/");
  if (!state?.startsWith(".clerk/") || !existsSync(state)) {
    throw new Error(`${name} must name an existing ignored .clerk state`);
  }
}

export default defineConfig({
  testDir: ".",
  testMatch: [
    "finance-remediation.spec.ts",
    "operations-remediation.spec.ts",
    "onboarding-replay-connected.spec.ts",
    "messaging-remediation.spec.ts",
    "analytics-positive-control.spec.ts",
    "draft-remediation.spec.ts",
  ],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 25_000 },
  reporter: [["list"], ["json", { outputFile: path.join(outputDir, "results.json") }]],
  outputDir,
  use: {
    baseURL,
    actionTimeout: 25_000,
    navigationTimeout: 60_000,
    storageState: process.env.PLAYWRIGHT_OWNER_AUTH_STATE,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1491, height: 1055 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
});
