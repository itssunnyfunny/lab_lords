import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Real renderer and mocked-service checks, without the destructive DB setup.
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: "node",
        setupFiles: ["tests/reference-dashboard/no-external-io.ts"],
        include: [
            "tests/unit/components/AllocationsTable.test.tsx",
            "tests/unit/lib/seat-view-state.test.ts",
            "tests/unit/services/seat-pagination.test.ts",
        ],
    },
});
