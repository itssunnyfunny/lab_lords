import path from "node:path";
import { defineConfig } from "@playwright/test";
import existing from "./playwright.config";

const output = path.resolve(process.env.VISUAL_AUDIT_RUN_ROOT || "test-results/ui-refinement", "onboarding");
export default defineConfig({
    ...existing,
    use: { ...existing.use, channel: "chrome" },
    outputDir: output,
    reporter: [["list"], ["json", { outputFile: path.join(output, "results.json") }]],
});
