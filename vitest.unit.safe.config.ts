import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// DB-free unit runner. The repository default config has a database-resetting
// global setup; this runner instead rejects unexpected database/network IO.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["tests/reference-dashboard/no-external-io.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
