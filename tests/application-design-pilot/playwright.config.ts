import path from "node:path";
import { defineConfig } from "@playwright/test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
    testDir: import.meta.dirname,
    testMatch: ["*.spec.ts"],
    outputDir: path.join(repositoryRoot, "test-results/application-design-pilot"),
    workers: 1,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    use: {
        baseURL: "http://127.0.0.1:4187",
        locale: "en-IN",
        timezoneId: "Asia/Kolkata",
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    projects: [
        {
            name: "desktop-1440",
            use: { viewport: { width: 1440, height: 1024 } },
        },
        {
            name: "tablet-834",
            use: { viewport: { width: 834, height: 1112 }, hasTouch: true },
        },
        {
            name: "mobile-390",
            use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
        },
        {
            name: "mobile-320",
            use: { viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true },
        },
    ],
    webServer: {
        command: "node tests/application-design-pilot/server.mjs",
        cwd: repositoryRoot,
        url: "http://127.0.0.1:4187",
        reuseExistingServer: true,
        timeout: 120_000,
    },
});
