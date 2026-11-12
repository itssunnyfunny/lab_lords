import path from "node:path";
import { defineConfig } from "@playwright/test";
import existing from "../application-design-pilot/playwright.config";
const output = process.env.VISUAL_AUDIT_RUN_ROOT ? path.resolve(process.env.VISUAL_AUDIT_RUN_ROOT, "focused") : path.resolve("test-results/visual-consistency-2026-11-07");
export default defineConfig({
    ...existing, testDir: import.meta.dirname, testMatch: "*.spec.ts",
    outputDir: output,
    reporter: [["list"], ["json", { outputFile: path.join(output, "results.json") }]],
    use: { ...existing.use, baseURL: "http://127.0.0.1:4193", channel: "chrome", contextOptions: { reducedMotion: "reduce" } },
    webServer: { ...existing.webServer, command: "node tests/visual-consistency/server.mjs", url: "http://127.0.0.1:4193" },
});
