import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openPilot(page: Page, path: string, query: Record<string, string> = {}) {
    const params = new URLSearchParams({ mode: "after", lang: "en", ...query });
    await page.goto(`${path}?${params.toString()}`);
    await expect(page.getByTestId("synthetic-pilot-label")).toBeVisible();
}

test("baseline and after modes use the same real shell with isolated theme activation", async ({ page }, testInfo) => {
    await openPilot(page, "/branch/pilot", { mode: "baseline" });
    await expect(page.locator("[data-app-design-pilot]")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Shanti Study Library" })).toBeVisible();

    await openPilot(page, "/branch/pilot", { mode: "after" });
    await expect(page.locator('[data-app-design-pilot="workspace"]')).toBeVisible();
    if (!testInfo.project.name.startsWith("desktop")) {
        await expect(page.getByLabel("Open navigation")).toBeVisible();
    } else {
        await expect(page.getByLabel("Branch navigation")).toBeVisible();
    }
});

test("student search, details, and edit keep the active roster context", async ({ page }) => {
    await openPilot(page, "/branch/pilot/students");
    const search = page.getByLabel("Search students by name or phone");
    await search.fill("Aarav");
    await expect(page.locator("p:visible").filter({ hasText: /^Aarav Mehta$/ }).first()).toBeVisible();
    await expect(page.getByText("Meera Singh", { exact: true })).toHaveCount(0);

    await page.locator('button[aria-label="Actions"]:visible').first().click();
    await page.getByRole("menuitem", { name: /Edit Details/ }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit student" });
    await editDialog.getByLabel("Full Name *").fill("Aarav Mehta Updated");
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.locator("p:visible").filter({ hasText: /^Aarav Mehta Updated$/ }).first()).toBeVisible();
    await expect(search).toHaveValue("Aarav");

    await page.locator('button[aria-label="Actions"]:visible').first().click();
    await page.getByRole("menuitem", { name: /View Fees/ }).click();
    await expect(page.getByRole("dialog", { name: "Aarav Mehta Updated" })).toBeVisible();
    await expect(page.getByText("Payment history", { exact: true })).toBeVisible();
});

test("seat scope exposes availability and completes a synthetic allocation interaction", async ({ page }) => {
    await openPilot(page, "/branch/pilot/seats");
    await expect(page.getByRole("heading", { name: "Seats" })).toBeVisible();
    await page.getByRole("button", { name: /Morning/ }).first().click();

    const availableSeat = page.getByRole("article", { name: "Seat A3" });
    await expect(availableSeat.getByText("Available", { exact: true }).first()).toBeVisible();
    await availableSeat.getByRole("button", { name: "Assign" }).click();

    const allocationDialog = page.getByRole("dialog", { name: "Allocate seat" });
    await allocationDialog.getByRole("button", { name: /Meera Singh/ }).click();
    await expect(allocationDialog.getByText(/1 shift(?:\(s\))? selected/)).toBeVisible();
    await allocationDialog.getByRole("button", { name: /^Confirm/ }).click();
    await expect(allocationDialog).toHaveCount(0);
});

test("partial collection retains one request through uncertainty and returns a receipt", async ({ page }) => {
    await openPilot(page, "/branch/pilot/payments", { surface: "collection", scenario: "uncertain" });
    let dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName("Collect fee");
    await dialog.getByLabel("Amount received (whole ₹)").fill("700");
    await dialog.getByLabel("Reference (optional)").fill("PILOT-UPI-700");
    await dialog.getByLabel("Note (shown on receipt, optional)").fill("Synthetic partial payment");
    await dialog.getByRole("button", { name: "Confirm collection", exact: true }).click();

    await expect(dialog.getByRole("button", { name: "Retry same collection" })).toBeVisible();
    const uncertainAlert = dialog.getByRole("alert");
    await expect(uncertainAlert).toBeVisible();
    await expect(dialog.getByText(/may already be recorded/i)).toBeVisible();
    expect(await uncertainAlert.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
    })).toBe(true);
    const pendingRequest = await page.evaluate(
        () => sessionStorage.getItem("fee-collection:pilot:student-aarav")
    );
    expect(pendingRequest).toBeTruthy();

    await openPilot(page, "/branch/pilot");
    await openPilot(page, "/branch/pilot/payments", { surface: "collection", scenario: "uncertain" });
    dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Retry same collection" })).toBeVisible();
    await expect(dialog.getByText(/may already be recorded/i)).toBeVisible();
    await expect(dialog.getByLabel("Amount received (whole ₹)")).toBeDisabled();
    expect(await page.evaluate(
        () => sessionStorage.getItem("fee-collection:pilot:student-aarav")
    )).toBe(pendingRequest);

    await dialog.getByLabel("Interface language").selectOption("hinglish");
    await dialog.getByRole("button", { name: "Usi payment ko dobara confirm karein" }).click();

    await expect(dialog.getByRole("heading", { name: "Payment record ho gaya" })).toBeVisible();
    await expect(dialog.getByText(/Received: ₹700/i)).toBeVisible();
    await expect(dialog.getByText(/Remaining ₹300/i)).toBeVisible();
    await dialog.getByLabel("Receipt aur report ki language").selectOption("hi");
    await expect(dialog.getByRole("heading", { name: "फीस की रसीद" })).toBeVisible();
});

test("empty, no-results, failed, restricted, and read-only fixture states stay distinct", async ({ page }) => {
    await openPilot(page, "/branch/pilot/students", { state: "empty" });
    await expect(page.getByText("No students in this view yet.").filter({ visible: true }).first()).toBeVisible();

    await openPilot(page, "/branch/pilot/students");
    await page.getByLabel("Search students by name or phone").fill("Definitely missing");
    await expect(page.getByText("No students match this search or shift filter.").filter({ visible: true }).first()).toBeVisible();

    await openPilot(page, "/branch/pilot/students", { state: "error" });
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();

    await openPilot(page, "/branch/pilot/students", { role: "restricted" });
    await expect(page.getByText(/Fee details are hidden/)).toBeVisible();
    await expect(page.getByText(/Seat assignment actions are disabled/)).toBeVisible();

    await openPilot(page, "/branch/pilot/students", { role: "readonly" });
    await expect(page.getByText("Workspace is read-only", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add student" })).toBeDisabled();
});

test("English, Hindi, and Hinglish are selected by app preference rather than browser locale", async ({ page }, testInfo) => {
    for (const [language, htmlLanguage] of [["en", "en-IN"], ["hi", "hi-IN"], ["hinglish", "hi-Latn-IN"]] as const) {
        await openPilot(page, "/branch/pilot/students", { lang: language });
        await expect(page.locator("html")).toHaveAttribute("lang", htmlLanguage);
        await expect(page.getByLabel(/Interface language|स्क्रीन की भाषा|Screen ki language/)).toHaveValue(language);
        if (language === "hi") {
            await expect(page.getByLabel("शिफ्ट के हिसाब से छात्र देखें")).toContainText("सभी शिफ्ट");
            await expect(page.getByText("सक्रिय", { exact: true }).filter({ visible: true }).first()).toBeVisible();
            if (!testInfo.project.name.startsWith("desktop")) {
                await expect(page.getByRole("link", { name: "ब्रांच डैशबोर्ड पर वापस जाएँ" })).toBeVisible();
            }
        }
    }
});

test("compact shell mounts one reachable navigation drawer", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith("desktop"), "Compact-shell-only assertion");
    await openPilot(page, "/branch/pilot");
    const trigger = page.getByRole("button", { name: /Open navigation|नेविगेशन खोलें|Navigation kholein/ });
    const switcher = page.getByRole("combobox", { name: "Org / Branch" });
    const search = page.getByRole("button", { name: "Search current branch" });
    const [triggerBox, switcherBox, searchBox] = await Promise.all([
        trigger.boundingBox(),
        switcher.boundingBox(),
        search.boundingBox(),
    ]);
    expect(triggerBox).not.toBeNull();
    expect(switcherBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(switcherBox!.width).toBeGreaterThanOrEqual(120);
    expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(switcherBox!.x);
    expect(switcherBox!.x + switcherBox!.width).toBeLessThanOrEqual(searchBox!.x);
    await trigger.click();
    const drawer = page.getByRole("dialog", { name: /Workspace navigation|वर्कस्पेस मेन्यू|Workspace navigation/ });
    await expect(drawer).toBeVisible();
    await expect(page.getByLabel("Branch navigation")).toHaveCount(1);
    const settings = drawer.getByRole("link", { name: "Branch Settings" });
    await expect(settings).toBeVisible();
    const settingsBox = await settings.boundingBox();
    expect(settingsBox).not.toBeNull();
    expect(settingsBox!.y).toBeGreaterThanOrEqual(0);
    expect(settingsBox!.y + settingsBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});

test("collection baseline and after modes use different scoped overlay themes", async ({ page }) => {
    await openPilot(page, "/branch/pilot/payments", { mode: "baseline", surface: "collection" });
    await expect(page.locator('[data-dialog-overlay="true"]')).not.toHaveClass(/app-design-pilot-overlay/);

    await openPilot(page, "/branch/pilot/payments", { mode: "after", surface: "collection" });
    await expect(page.locator('[data-dialog-overlay="true"]')).toHaveClass(/app-design-pilot-overlay/);
});

test("keyboard row action restores focus after its dialog closes", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "One keyboard check covers the shared row action primitive");
    await openPilot(page, "/branch/pilot/students");
    const trigger = page.getByRole("button", { name: "Actions" }).first();
    await trigger.focus();
    await trigger.press("Enter");
    const editAction = page.getByRole("menuitem", { name: /Edit Details/ });
    await editAction.focus();
    await editAction.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Edit student" });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
});

test("representative pilot surfaces have no serious automated accessibility violations", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "One desktop scan covers the shared component states");

    for (const path of [
        "/branch/pilot",
        "/branch/pilot/students?lang=hi",
        "/branch/pilot/seats?lang=hinglish",
        "/branch/pilot/payments?surface=collection&scenario=uncertain",
    ]) {
        const separator = path.includes("?") ? "&" : "?";
        await page.goto(`${path}${separator}mode=after`);
        await expect(page.getByTestId("synthetic-pilot-label")).toBeVisible();
        await expect(page.locator("main h1:visible, [role='dialog'] h2:visible").first()).toBeVisible();
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(
            violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical"),
            `Serious accessibility findings on ${path}`
        ).toEqual([]);
    }
});

test("desktop content stays operable at a 200 percent equivalent CSS viewport", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "Desktop zoom-equivalent assertion");
    await page.setViewportSize({ width: 720, height: 800 });
    await openPilot(page, "/branch/pilot/students", { lang: "hi" });
    await expect(page.getByRole("button", { name: "मेन्यू खोलें" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "छात्र" })).toBeVisible();
    const hasPageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasPageOverflow).toBe(false);
});
