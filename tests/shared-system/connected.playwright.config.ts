import { defineConfig } from "@playwright/test";
import existing from "../dashboard-connected/playwright.config";
export default defineConfig({ ...existing, testDir: "../dashboard-connected", testMatch: "students-pattern.spec.ts", outputDir: "../../test-results/students-connected" });
