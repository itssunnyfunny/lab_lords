import path from "node:path";
import { defineConfig } from "@playwright/test";
const root = path.resolve(import.meta.dirname, "../../..");
export default defineConfig({
 testDir: import.meta.dirname, testMatch: "journey.spec.ts", workers: 1, timeout: 45000,
 outputDir: path.join(root,"test-results/organization-preview"),
 reporter: [["list"],["json",{outputFile:path.join(root,"test-results/organization-preview/results.json")}]],
 use: {baseURL:"http://127.0.0.1:4187",locale:"en-IN",timezoneId:"Asia/Kolkata",screenshot:"only-on-failure",trace:"retain-on-failure"},
 projects: [{name:"desktop",use:{viewport:{width:1440,height:1000}}},{name:"mobile",use:{viewport:{width:390,height:844}}}],
 webServer:{command:"node tests/application-design-pilot/server.mjs",cwd:root,url:"http://127.0.0.1:4187",reuseExistingServer:true},
});
