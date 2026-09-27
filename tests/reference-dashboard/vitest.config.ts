import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/** Explicit unit allowlist. Never inherits the repository's truncating global setup. */
export default defineConfig({ plugins: [tsconfigPaths()], test: {
    environment: "node", setupFiles: ["tests/reference-dashboard/no-external-io.ts"],
    include: [
        "tests/unit/lib/dashboard-contracts.test.ts", "tests/unit/services/dashboard.service.test.ts", "tests/unit/api/dashboard.route.test.ts",
        "tests/unit/lib/branch-reports.test.ts", "tests/unit/services/branch-report-service.test.ts",
        "tests/unit/lib/branch-dashboard.test.ts", "tests/unit/lib/dashboard-presentation.test.ts", "tests/unit/lib/dashboard-fixture.test.ts",
        "tests/unit/lib/application-design-pilot.test.ts", "tests/unit/application-pilot-theme.test.ts",
        "tests/unit/components/BranchSidebar.test.tsx", "tests/unit/components/WorkspaceSwitcher.test.tsx", "tests/unit/components/StatCard.test.tsx",
        "tests/unit/components/reference-dashboard.test.tsx", "tests/unit/lib/branch-capabilities.test.ts",
        "tests/unit/lib/localization.test.ts", "tests/unit/lib/public-localization.test.ts",
        "tests/unit/lib/topSearch.test.ts", "tests/unit/services/branch-search.test.ts",
        "tests/unit/lib/feeBalance.test.ts", "tests/unit/lib/renewals.test.ts", "tests/unit/lib/paymentStatus.test.ts",
        "tests/unit/lib/overdue-queue.test.ts", "tests/unit/lib/attendance.test.ts", "tests/unit/lib/attendance-qr.test.ts",
        "tests/unit/lib/attendance-camera.test.ts", "tests/unit/utils/studentBillingCycles.test.ts",
    ],
} });
