import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
    testDir: "./tests/localization-browser", testMatch: "*.spec.ts", workers: 1, timeout: 60000,
    use: { baseURL: "http://127.0.0.1:4179", screenshot: "only-on-failure" },
    projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 7"] } }],
    webServer: { command: "pnpm exec node tests/localization-browser/server.mjs", url: "http://127.0.0.1:4179", reuseExistingServer: true },
});
