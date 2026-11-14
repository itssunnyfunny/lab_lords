import path from "node:path";
import { defineConfig } from "@playwright/test";
import existing from "./playwright.config";

// Real Settings components, synthetic APIs, and no authenticated application server.
const output = path.resolve("test-results/whatsapp-audit-2026-11-13/browser");
export default defineConfig({
  ...existing,
  testMatch: "whatsapp-controls.spec.ts",
  outputDir: output,
  reporter: [["list"], ["json", { outputFile: path.join(output, "results.json") }]],
});
