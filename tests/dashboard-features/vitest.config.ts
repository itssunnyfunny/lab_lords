import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// No database, dotenv or shared integration setup is loaded by this unit suite.
export default defineConfig({ plugins: [tsconfigPaths()], test: { environment: "node", include: [
    "tests/unit/lib/branch-reports.test.ts", "tests/unit/services/branch-report-service.test.ts",
    "tests/unit/components/BranchSidebar.test.tsx", "tests/unit/components/WorkspaceSwitcher.test.tsx",
    "tests/unit/lib/application-design-pilot.test.ts", "tests/unit/lib/localization.test.ts",
] } });
