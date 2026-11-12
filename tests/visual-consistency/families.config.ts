import path from "node:path";
import { defineConfig } from "@playwright/test";
import existing from "./playwright.config";

const output = path.resolve(process.env.VISUAL_AUDIT_RUN_ROOT || "test-results/ui-refinement", "families");
export default defineConfig({
    ...existing,
    testDir: path.resolve("tests/application-design-pilot"),
    testMatch: ["shared-system.spec.ts", "student-card.spec.ts", "staff-family.spec.ts", "tasks-family.spec.ts", "settings-family.spec.ts", "work-queues-family.spec.ts", "seats-shifts-family.spec.ts", "payments-family.spec.ts", "attendance-family.spec.ts", "reporting-family.spec.ts", "guided-family.spec.ts", "workspace-entry-family.spec.ts", "route-boundaries.spec.ts", "reference-regression.spec.ts"],
    projects: existing.projects?.filter(project => ["desktop-1440", "mobile-390"].includes(project.name!)),
    outputDir: output,
    reporter: [["list"], ["json", { outputFile: path.join(output, "results.json") }]],
});
