import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const output = path.resolve("docs/redesign/dashboard-component-evidence");
const regions = JSON.parse(fs.readFileSync(path.resolve("tests/application-design-pilot/dashboard-component-regions.json"), "utf8")) as Array<{
    key: string;
    selector: string;
}>;

test("capture settled dashboard components at native browser scale", async ({ page, request }, info) => {
    test.skip(info.project.name !== "desktop-1440", "Native component comparison uses the fixed 1440px desktop project");
    await request.post("/api/pilot/reset", { maxRetries: 2 });
    await page.clock.setFixedTime(new Date("2026-09-23T08:30:00Z"));
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.goto("/branch/pilot?mode=after&lang=en&state=busy");
    await expect(page.locator("main h1")).toHaveText("Shanti Study Library");
    await expect(page.locator("[data-dashboard-refinement]")).toHaveAttribute("aria-busy", "false");
    await page.evaluate(async () => {
        await Promise.all([
            document.fonts.load('600 24px "Playfair Display"'),
            document.fonts.load('400 14px "Inter"'),
            document.fonts.load('400 14px "Noto Sans Devanagari"', "उपस्थिति"),
        ]);
        await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    const scale = await page.evaluate(() => ({ pixelRatio: window.devicePixelRatio, zoom: window.visualViewport?.scale ?? 1 }));
    expect(page.viewportSize()).toEqual({ width: 1440, height: 1024 });
    expect(scale).toEqual({ pixelRatio: 1, zoom: 1 });
    const ribbonHeight = await page.getByTestId("synthetic-pilot-label").evaluate(element => element.getBoundingClientRect().height);
    const geometry = [];
    fs.mkdirSync(path.join(output, "render"), { recursive: true });
    for (const region of regions) {
        const locator = page.locator(region.selector);
        await expect(locator).toBeVisible();
        const box = await locator.boundingBox();
        expect(box).not.toBeNull();
        geometry.push({
            key: region.key,
            selector: region.selector,
            viewport: box,
            app: { ...box!, y: box!.y - ribbonHeight },
        });
    }
    // Locator screenshots can scroll the page. Measure every panel first so all
    // coordinates refer to the same settled viewport rather than successive scrolls.
    for (const region of regions) {
        const locator = page.locator(region.selector);
        await locator.screenshot({ path: path.join(output, "render", `${region.key}.png`), animations: "disabled" });
    }
    fs.writeFileSync(path.join(output, "geometry.json"), JSON.stringify({
        viewport: page.viewportSize(),
        ...scale,
        syntheticRibbonHeight: ribbonHeight,
        fixture: "state=busy&mode=after&lang=en, 2026-09-23T08:30:00Z",
        regions: geometry,
    }, null, 2));
    expect(pageErrors).toEqual([]);
});
