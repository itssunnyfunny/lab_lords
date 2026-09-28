import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: ".", testMatch: "*.spec.ts", workers: 1, fullyParallel: false,
    timeout: 300_000, expect: { timeout: 25_000 }, retries: 0,
    reporter: "list", outputDir: "../../test-results/dashboard-connected",
    use: {
        actionTimeout: 25_000, navigationTimeout: 60_000,
        baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117",
        storageState: process.env.PLAYWRIGHT_OWNER_AUTH_STATE || ".clerk/dashboard-owner-auth.json",
        screenshot: "only-on-failure", trace: "off", video: "off",
    },
    projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1491, height: 1055 } } }],
});
