import {defineConfig} from "@playwright/test";
export default defineConfig({testDir:".",testMatch:"basic-workspace.spec.ts",workers:1,timeout:300_000,expect:{timeout:20_000},
 reporter:[["./redact-reporter.ts"],["list"],["json",{outputFile:"../../test-results/basic-workspace/connected.json"}]],outputDir:"../../test-results/basic-connected",
 use:{actionTimeout:60_000,baseURL:"http://localhost:3117",storageState:".clerk/dashboard-owner-auth.json",viewport:{width:1440,height:1000},screenshot:"only-on-failure",trace:"off"}});
