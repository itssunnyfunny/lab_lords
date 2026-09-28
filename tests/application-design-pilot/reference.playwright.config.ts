import path from "node:path";
import { defineConfig } from "@playwright/test";
export default defineConfig({
    testDir: import.meta.dirname, testMatch: "reference.spec.ts", workers: 1,
    timeout: 90_000, expect: { timeout: 15000 }, reporter: "list",
    outputDir: path.resolve("test-results/reference-dashboard"),
    use: { baseURL: "http://127.0.0.1:4187", locale: "en-IN", timezoneId: "Asia/Kolkata", deviceScaleFactor: 1, screenshot: "only-on-failure", trace: "retain-on-failure" },
    projects: [
        {name:"desktop-native",use:{viewport:{width:1491,height:1076}}},
        {name:"tablet-834",use:{viewport:{width:834,height:1112},hasTouch:true}},
        {name:"mobile-390",use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
        {name:"mobile-320",use:{viewport:{width:320,height:720},isMobile:true,hasTouch:true}},
    ],
    webServer:{command:"node tests/application-design-pilot/server.mjs",url:"http://127.0.0.1:4187",reuseExistingServer:true,timeout:120000},
});
