import path from "node:path";
import { defineConfig } from "@playwright/test";
import visual from "./playwright.config";
const output = process.env.VISUAL_AUDIT_RUN_ROOT ? path.resolve(process.env.VISUAL_AUDIT_RUN_ROOT, "shared") : path.resolve("test-results/visual-shared-regression-2026-11-07");
export default defineConfig({ ...visual,
    testDir: path.resolve("tests/application-design-pilot"),
    testMatch: ["shared-system.spec.ts", "student-card.spec.ts", "staff-family.spec.ts", "tasks-family.spec.ts", "payments-family.spec.ts", "seats-shifts-family.spec.ts", "route-boundaries.spec.ts", "reference-regression.spec.ts"],
    projects: visual.projects?.filter(project => ["desktop-1440", "mobile-390"].includes(project.name!)),
    outputDir: output,
    reporter: [["list"], ["json", { outputFile: path.join(output, "results.json") }]],
});
