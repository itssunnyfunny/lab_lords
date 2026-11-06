import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Pure import presentation/domain checks; never load the truncating DB setup.
export default defineConfig({ plugins: [tsconfigPaths()], test: {
    environment: "node", setupFiles: ["tests/reference-dashboard/no-external-io.ts"],
    include: ["tests/unit/importing/guided-import-presentation.test.ts", "tests/unit/importing/import-readiness.test.ts",
        "tests/unit/importing/current-month-import.test.ts", "tests/unit/importing/guided-payment-draft.test.ts",
        "tests/unit/importing/guided-setup.test.ts", "tests/unit/importing/guided-import-results.test.tsx",
        "tests/unit/importing/guided-source-reconciliation.test.ts", "tests/unit/importing/untidy-register.test.ts",
        "tests/unit/lib/localization.test.ts", "tests/unit/importing/guided-payment-problem.test.tsx"],
} });
