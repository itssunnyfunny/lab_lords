import { defineConfig } from "@playwright/test";
import existing from "../dashboard-connected/playwright.config";
export default defineConfig({ ...existing, testDir: "../dashboard-connected", testMatch: "batch-two.spec.ts", outputDir: "../../test-results/batch-two-connected" });
