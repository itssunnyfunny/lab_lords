import { defineConfig } from "@playwright/test";
import existing from "../application-design-pilot/playwright.config";
export default defineConfig({ ...existing, testMatch: ["shared-system.spec.ts", "student-card.spec.ts", "staff-family.spec.ts", "tasks-family.spec.ts", "pilot.spec.ts", "reference-regression.spec.ts"], outputDir: "../../test-results/shared-system" });
