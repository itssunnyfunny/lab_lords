import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Explicit unit-only allowlist. No .env.test, Prisma, database setup or truncation.
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: "node",
        include: [
            "tests/unit/lib/branch-dashboard.test.ts",
            "tests/unit/lib/dashboard-presentation.test.ts",
            "tests/unit/lib/dashboard-fixture.test.ts",
            "tests/unit/lib/application-design-pilot.test.ts",
            "tests/unit/lib/localization.test.ts",
            "tests/unit/application-pilot-theme.test.ts",
            "tests/unit/components/BranchSidebar.test.tsx",
            "tests/unit/components/WorkspaceSwitcher.test.tsx",
        ],
    },
});
