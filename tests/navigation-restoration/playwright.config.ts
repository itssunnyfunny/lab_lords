import { defineConfig } from "@playwright/test";
import path from "node:path";
import existing from "../application-design-pilot/playwright.config";

export default defineConfig({ ...existing, testDir: import.meta.dirname, testMatch: "navigation.spec.ts", outputDir: "../../test-results/navigation-restoration/browser", timeout: 60_000,
    reporter: [["list"], ["json", { outputFile: path.resolve(import.meta.dirname, "../../test-results/navigation-restoration/browser-results.json") }]],
});
