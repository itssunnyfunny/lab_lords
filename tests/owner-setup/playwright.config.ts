import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "../browser", testMatch: "owner-setup-connected.spec.ts", workers: 1, timeout: 180_000,
    outputDir: "../../test-results/owner-setup/browser", reporter: [["list"]],
    use: { channel: "chromium", actionTimeout: 15_000, baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3149", storageState: ".clerk/owner-setup-auth.json", trace: "off", screenshot: "only-on-failure" } });
