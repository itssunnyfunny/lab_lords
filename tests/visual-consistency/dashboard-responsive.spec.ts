import { expect, test } from "@playwright/test";

test("dashboard widths keep compact actions, four metrics and a prioritized attention list", async ({ page, context }, info) => {
    test.skip(info.project.name !== "tablet-834", "One project checks the complete intermediate-width matrix.");
    // This case renders 15 independent language/width combinations. Individual assertions retain their normal deadlines.
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    for (const language of ["en", "hi", "hinglish"]) {
        for (const width of [641, 834, 1024, 1280, 1350]) {
            await page.setViewportSize({ width, height: 1112 });
            await page.goto(`/branch/pilot?mode=after&lang=${language}`);
            await page.locator(".rd-heatmap button").first().waitFor();
            await page.evaluate(() => document.fonts.ready);
            const title = (await page.locator(".rd-heading-main").boundingBox())!;
            const actions = (await page.locator(".rd-primary-actions").boundingBox())!;
            const heading = (await page.locator(".rd-heading").boundingBox())!;
            expect(title.width).toBeGreaterThan(240);
            expect(actions.y + actions.height).toBeLessThanOrEqual(heading.y + heading.height + 1);
            await expect(page.locator(".rd-illustration")).toHaveCount(0);
            await expect(page.locator(".rd-metrics article")).toHaveCount(4);
            const numberFonts = await page.locator(".rd-metrics strong, .rd-chart-summary dd, .rd-seating-summary dd").evaluateAll(nodes => nodes.map(node => getComputedStyle(node).fontFamily));
            expect(numberFonts.length).toBeGreaterThan(4);
            expect(numberFonts.every(font => font.includes("sans-serif") && !font.includes("Georgia"))).toBe(true);
            await expect(page.locator(".rd-attention-list article")).toHaveCount(4);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            const buttons = page.locator(".rd-primary-actions").getByRole("button").or(page.locator(".rd-primary-actions a"));
            await expect(buttons).toHaveCount(2);
            for (const button of await buttons.all()) {
                const box = (await button.boundingBox())!;
                expect(box.x).toBeGreaterThanOrEqual(actions.x - 1);
                expect(box.x + box.width).toBeLessThanOrEqual(width);
            }
            await page.screenshot({ path: info.outputPath(`dashboard-${width}-${language}.png`), animations: "disabled" });
        }
    }
    expect(errors).toEqual([]);
});

test("mobile workspace header keeps organization and branch labels separate", async ({ page, context }, info) => {
    test.skip(!info.project.name.startsWith("mobile"), "Checks the mobile workspace header.");
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    await page.route("**/api/organizations/org-pilot/branches", route => route.fulfill({ json: [{
        id: "pilot", organizationId: "org-pilot", name: "Shanti Study Library", city: "Indore", defaultFee: 1400,
        _count: { students: 3, seats: 8, shifts: 2 },
    }] }));
    for (const language of ["en", "hi", "hinglish"]) {
        for (const [name, route] of [["dashboard", "/branch/pilot"], ["students", "/branch/pilot/students"], ["import", "/branch/pilot/onboarding/import"], ["organization", "/org/org-pilot"]]) {
            await page.goto(`${route}?mode=after&lang=${language}`);
            const switcher = page.locator(".reference-topbar .reference-workspace-switcher");
            const organization = switcher.locator(".ui-workspace-organization");
            const branch = switcher.locator(":scope > label");
            await expect(organization).toContainText("Shanti Learning Spaces");
            await page.evaluate(() => document.fonts.ready);
            const organizationBox = (await organization.boundingBox())!;
            const branchBox = (await branch.boundingBox())!;
            expect(organizationBox.y + organizationBox.height).toBeLessThanOrEqual(branchBox.y);
            expect(await organization.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
            const select = (await branch.locator("select").boundingBox())!;
            expect(select.height).toBeGreaterThanOrEqual(44);
            expect(select.x + select.width).toBeLessThanOrEqual(info.project.use.viewport!.width);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            await page.screenshot({ path: info.outputPath(`${name}-${language}.png`), animations: "disabled" });
        }
    }
    expect(errors).toEqual([]);
});
