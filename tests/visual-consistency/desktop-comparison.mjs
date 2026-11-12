import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { PNG } = createRequire(import.meta.resolve("next/package.json"))("pngjs");
const output = path.resolve(process.env.VISUAL_AUDIT_RUN_ROOT ? path.join(process.env.VISUAL_AUDIT_RUN_ROOT, "desktop") : "test-results/visual-desktop-comparison-2026-11-07");
mkdirSync(output, { recursive: true });
const original = execFileSync("git", ["show", "HEAD:styles/reference-dashboard.css"], { encoding: "utf8", windowsHide: true });
const baseline = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).trim();
const current = readFileSync("styles/reference-dashboard.css", "utf8").replaceAll("\r\n", "\n");
if (!current.startsWith(original.replaceAll("\r\n", "\n").trimEnd())) throw new Error("Desktop CSS changed outside the appended responsive rules");
const browser = await chromium.launch({ channel: "chrome", args: ["--disable-gpu"] });
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, locale: "en-IN", timezoneId: "Asia/Kolkata", reducedMotion: "reduce" });
    await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    await page.clock.setFixedTime(new Date("2026-09-22T10:11:00+05:30"));
    await page.goto("http://127.0.0.1:4193/branch/pilot?mode=after&lang=en");
    await page.locator(".rd-heatmap button").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    // Fonts alone do not prove that decorative images have decoded and painted.
    // Require two identical captures, as screenshot assertions do, before comparing.
    async function settledCapture(filename) {
        await page.evaluate(() => Promise.all(Array.from(document.images, image => image.decode())));
        let prior = await page.screenshot({ animations: "disabled" });
        for (let attempt = 0; attempt < 10; attempt++) {
            await page.waitForTimeout(150);
            const current = await page.screenshot({ animations: "disabled" });
            if (current.equals(prior)) { writeFileSync(path.join(output, filename), current); return current; }
            prior = current;
        }
        throw new Error("Dashboard pixels did not settle before comparison");
    }
    const after = await settledCapture("after.png");
    const removed = await page.evaluate(() => {
        let count = 0;
        const visit = owner => {
            for (let i = owner.cssRules.length - 1; i >= 0; i--) {
                const rule = owner.cssRules[i];
                if (rule instanceof CSSMediaRule && ((rule.cssText.includes("summary, select") && rule.cssText.includes("min-width: 400px"))
                    || (rule.conditionText.includes("641px") && rule.conditionText.includes("1350px") && rule.cssText.includes(".rd-heading-main"))
                    || (rule.conditionText.includes("639px") && rule.cssText.includes("overflow-wrap: anywhere")))) {
                    if (matchMedia(rule.conditionText).matches) throw new Error("Responsive audit rule unexpectedly applies at desktop width");
                    owner.deleteRule(i); count++;
                } else if (rule.cssRules) visit(rule);
            }
        };
        for (const sheet of document.styleSheets) visit(sheet);
        return count;
    });
    if (removed !== 3) throw new Error("Could not isolate all three appended responsive rules in the bundled stylesheet");
    const before = await settledCapture("before.png");
    const a = PNG.sync.read(after), b = PNG.sync.read(before);
    let differentPixels = 0, maxChannelDifference = 0, pixelsBeyondTolerance = 0;
    for (let i = 0; i < a.data.length; i += 4) {
        const delta = Math.max(...[0, 1, 2, 3].map(channel => Math.abs(a.data[i + channel] - b.data[i + channel])));
        if (delta) differentPixels++;
        if (delta > 1) pixelsBeyondTolerance++;
        maxChannelDifference = Math.max(maxChannelDifference, delta);
    }
    const result = { viewport: "1440x1024", baseline, byteIdentical: after.equals(before), differentPixels, maxChannelDifference,
        pixelsBeyondTolerance, channelTolerance: 1, scope: "Working dashboard markup rendered with pre-fix versus corrected dashboard CSS; one-channel raster rounding tolerance" };
    writeFileSync(path.join(output, "comparison.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    if (pixelsBeyondTolerance) process.exitCode = 1;
} finally { await browser.close(); }
