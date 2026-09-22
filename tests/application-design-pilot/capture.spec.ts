import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const captureEnabled = process.env.PILOT_CAPTURE === "1";
const captureLabel = process.env.PILOT_CAPTURE_LABEL ?? "review";
const captureMode = process.env.PILOT_CAPTURE_MODE;
const modes = captureMode === "baseline" || captureMode === "after"
    ? [captureMode]
    : ["baseline", "after"] as const;
const captureRoot = path.resolve(
    process.env.PILOT_CAPTURE_DIR ?? "test-results/application-design-pilot/captures"
);

async function capture(page: Page, testInfo: TestInfo, name: string) {
    const directory = path.join(captureRoot, captureLabel, testInfo.project.name);
    fs.mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
}

async function open(page: Page, route: string, params: Record<string, string>) {
    const query = new URLSearchParams(params);
    await page.goto(`${route}?${query.toString()}`);
    await expect(page.getByTestId("synthetic-pilot-label")).toBeVisible();
}

async function resetDialogScroll(page: Page) {
    await page.getByRole("dialog").evaluate((element) => {
        element.scrollTop = 0;
    });
}

test("capture configured baseline and after representative surfaces", async ({ page }, testInfo) => {
    test.skip(!captureEnabled, "Set PILOT_CAPTURE=1 to write the review image matrix");

    const surfaces = [
        { name: "dashboard-en", route: "/branch/pilot", params: { lang: "en" }, ready: "Shanti Study Library" },
        { name: "students-hi", route: "/branch/pilot/students", params: { lang: "hi" }, ready: "Shanti Study Library" },
        { name: "seats-hinglish", route: "/branch/pilot/seats", params: { lang: "hinglish" }, ready: "Shanti Study Library" },
    ];

    for (const mode of modes) {
        for (const surface of surfaces) {
            await open(page, surface.route, { mode, ...surface.params });
            await expect(page.locator("main h1:visible").first()).toBeVisible();
            await capture(page, testInfo, `${mode}-${surface.name}`);
        }

        await open(page, "/branch/pilot/payments", {
            mode,
            lang: "en",
            surface: "collection",
            scenario: "uncertain",
        });
        const dialog = page.getByRole("dialog");
        await expect(dialog).toHaveAccessibleName("Collect fee");
        await dialog.getByLabel("Amount received (whole ₹)").fill("700");
        await capture(page, testInfo, `${mode}-collection-partial-en`);
        await dialog.getByRole("button", { name: "Confirm collection", exact: true }).click();
        await expect(dialog.getByRole("button", { name: "Retry same collection" })).toBeVisible();
        await capture(page, testInfo, `${mode}-collection-uncertain-en`);
        await dialog.getByRole("button", { name: "Retry same collection" }).click();
        await expect(dialog.getByRole("heading", { name: "Collection recorded" })).toBeVisible();
        await dialog.getByLabel("Document language").selectOption("hi");
        await expect(dialog.getByRole("heading", { name: "फीस की रसीद" })).toBeVisible();
        await resetDialogScroll(page);
        await capture(page, testInfo, `${mode}-collection-receipt-hi`);
    }

    if (modes.includes("after") && testInfo.project.name === "desktop-1440") {
        await open(page, "/branch/pilot/students", { mode: "after", lang: "en", state: "error" });
        await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
        await capture(page, testInfo, "after-students-error-en");

        await open(page, "/branch/pilot/students", { mode: "after", lang: "en", role: "restricted" });
        await expect(page.getByText(/Fee details are hidden/)).toBeVisible();
        await capture(page, testInfo, "after-students-restricted-en");
    }

    if (modes.includes("after") && testInfo.project.name === "mobile-390") {
        await open(page, "/branch/pilot/students", { mode: "after", lang: "en", state: "empty" });
        await expect(page.getByText("No students in this view yet.").filter({ visible: true }).first()).toBeVisible();
        await capture(page, testInfo, "after-students-empty-en");

        await open(page, "/branch/pilot", { mode: "after", lang: "en", role: "readonly" });
        await expect(page.getByText("Workspace is read-only", { exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Shanti Study Library" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Add student" })).toBeDisabled();
        await capture(page, testInfo, "after-dashboard-readonly-en");

        await open(page, "/branch/pilot", { mode: "after", lang: "hi" });
        await page.getByRole("button", { name: "मेन्यू खोलें" }).click();
        await expect(page.getByRole("dialog", { name: "वर्कस्पेस मेन्यू" })).toBeVisible();
        await capture(page, testInfo, "after-mobile-navigation-hi");
    }
});
