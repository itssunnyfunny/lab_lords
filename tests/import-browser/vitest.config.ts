import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({ plugins: [tsconfigPaths()], test: {
    environment: "node", globalSetup: "./tests/setup/global.ts", include: ["tests/import-browser/flow.test.ts"],
    fileParallelism: false, testTimeout: 150_000, hookTimeout: 120_000,
} });
