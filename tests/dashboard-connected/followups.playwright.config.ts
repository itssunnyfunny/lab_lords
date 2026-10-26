import { defineConfig, devices } from "@playwright/test";
import existing from "./playwright.config";
export default defineConfig({ ...existing, testMatch: "audit-followups.audit.ts", timeout: 240_000,
    outputDir: "../../test-results/audit-followups",
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1491, height: 1055 } } },
        { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    ],
});
