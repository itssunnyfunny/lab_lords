import path from "node:path";
import { defineConfig } from "@playwright/test";

/** Same isolated component server; no database, authentication or providers. */
export default defineConfig({
    testDir: import.meta.dirname, testMatch: "reference-regression.spec.ts", workers: 1,
    timeout: 45_000, expect: { timeout: 10_000 }, reporter: "list",
    outputDir: path.resolve("test-results/reference-dashboard-regression"),
    use: { baseURL: "http://127.0.0.1:4187", locale: "en-IN", timezoneId: "Asia/Kolkata", viewport: { width: 1491, height: 1076 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
    webServer: { command: "node tests/application-design-pilot/server.mjs", url: "http://127.0.0.1:4187", reuseExistingServer: true, timeout: 120_000 },
});
