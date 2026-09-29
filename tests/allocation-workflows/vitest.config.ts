import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Explicit allocation workflow tests; never load the database integration setup.
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: "node",
        setupFiles: ["tests/reference-dashboard/no-external-io.ts"],
        include: [
            "tests/unit/components/UpdateAllocationDialog.test.tsx",
            "tests/unit/components/allocation-student-selector.test.tsx",
            "tests/unit/lib/branch-capabilities.test.ts",
            "tests/unit/lib/localization.test.ts",
        ],
    },
});
