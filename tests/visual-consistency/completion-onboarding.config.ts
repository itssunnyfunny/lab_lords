import path from "node:path";
import {defineConfig} from "@playwright/test";
import existing from "../onboarding-browser/refinement.config";
const output=path.resolve(process.env.VISUAL_AUDIT_RUN_ROOT||"test-results/design-completion-2026-11-12/onboarding-final","onboarding");
export default defineConfig({...existing,testDir:path.resolve("tests/onboarding-browser"),outputDir:output,reporter:[["list"],["json",{outputFile:path.join(output,"results.json")}]],use:{...existing.use,baseURL:"http://127.0.0.1:4197"},webServer:{...existing.webServer,command:"node tests/visual-consistency/completion-onboarding-server.mjs",url:"http://127.0.0.1:4197",reuseExistingServer:false}});
