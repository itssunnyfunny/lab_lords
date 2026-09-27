import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
/** Explicit presentation/workflow allowlist; no truncating repository setup. */
export default defineConfig({ plugins: [tsconfigPaths()], test: {
    environment: "node", setupFiles: ["tests/reference-dashboard/no-external-io.ts"],
    include: ["tests/unit/components/record-pattern.test.tsx", "tests/unit/lib/student-roster.test.ts",
        "tests/unit/application-pilot-theme.test.ts", "tests/unit/components/reference-dashboard.test.tsx",
        "tests/unit/components/BranchSidebar.test.tsx", "tests/unit/components/WorkspaceSwitcher.test.tsx", "tests/unit/components/BranchWorkspaceShell.test.tsx",
        "tests/unit/lib/localization.test.ts", "tests/unit/lib/public-localization.test.ts", "tests/unit/lib/feeBalance.test.ts",
        "tests/unit/utils/studentBillingCycles.test.ts", "tests/unit/lib/seat-view-state.test.ts"],
} });
