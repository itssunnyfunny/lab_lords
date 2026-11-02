import { defineConfig } from "@playwright/test";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
export default defineConfig({
    testDir: import.meta.dirname, testMatch: "onboarding.spec.ts", workers: 1, timeout: 60_000,
    outputDir: path.join(root, "test-results/onboarding-browser"),
    use: { baseURL: "http://127.0.0.1:4193", locale: "en-IN", timezoneId: "Asia/Kolkata", trace: "retain-on-failure", screenshot: "only-on-failure" },
    projects: [
        { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
        { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    ],
    webServer: { command: "node tests/onboarding-browser/server.mjs", cwd: root, url: "http://127.0.0.1:4193", reuseExistingServer: false, timeout: 120_000 },
});
