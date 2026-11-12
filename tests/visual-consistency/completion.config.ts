import path from "node:path";
import { defineConfig } from "@playwright/test";
import existing from "./playwright.config";
const output=path.resolve(process.env.VISUAL_AUDIT_RUN_ROOT||"test-results/design-completion-2026-11-12/checks","completion");
export default defineConfig({...existing,testMatch:"completion-*.spec.ts",outputDir:output,reporter:[["list"],["json",{outputFile:path.join(output,"results.json")}]]});
